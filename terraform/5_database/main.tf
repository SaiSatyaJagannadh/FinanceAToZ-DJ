terraform {
  required_version = ">= 1.5"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  # Using local backend - state will be stored in terraform.tfstate in this directory
  # This is automatically gitignored for security
}

provider "aws" {
  region = var.aws_region
}

# Data source for current caller identity
data "aws_caller_identity" "current" {}

# ========================================
# Aurora Serverless v2 PostgreSQL Cluster
# ========================================

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Secrets Manager secret for database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "alex-aurora-credentials-${random_id.suffix.hex}"
  recovery_window_in_days = 0  # For development - immediate deletion
  
  tags = {
    Project = "alex"
    Part    = "5"
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "alexadmin"
    password = random_password.db_password.result
  })
}

# Aurora Serverless v2 Cluster
# AWS Free plan only allows Aurora "express" clusters (no VPC, IAM login only), which
# Terraform can't create. The cluster is created with the AWS CLI, Data API enabled, and the
# alexadmin user + alex database added by backend/database/setup_express_db.py
# (steps in notes/knowledge-article.md); Terraform just looks it up.
# On a paid plan, restore the course version: git show fbab9eb:terraform/5_database/main.tf
data "aws_rds_cluster" "aurora" {
  cluster_identifier = "alex-aurora-cluster"
}

# IAM role for Lambda to access Aurora Data API
resource "aws_iam_role" "lambda_aurora_role" {
  name = "alex-lambda-aurora-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Project = "alex"
    Part    = "5"
  }
}

# IAM policy for Data API access
resource "aws_iam_role_policy" "lambda_aurora_policy" {
  name = "alex-lambda-aurora-policy"
  role = aws_iam_role.lambda_aurora_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds-data:ExecuteStatement",
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:RollbackTransaction"
        ]
        Resource = data.aws_rds_cluster.aurora.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.db_credentials.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# Attach basic Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_aurora_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
