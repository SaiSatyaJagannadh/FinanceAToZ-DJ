terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.28.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

# Public (no login) endpoints for the frontend: free stock check (FinAI engines) and chat.
# Image is built and pushed by backend/stockcheck/deploy.py, which then sets stockcheck_image_uri.
locals {
  deployed = var.stockcheck_image_uri != ""
}

resource "aws_ecr_repository" "stockcheck" {
  name                 = "alex-stockcheck"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Project = "alex"
    Part    = "9"
  }
}

resource "aws_iam_role" "stockcheck" {
  name = "alex-stockcheck-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = {
    Project = "alex"
    Part    = "9"
  }
}

resource "aws_iam_role_policy_attachment" "stockcheck_logs" {
  role       = aws_iam_role.stockcheck.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "stockcheck_bedrock" {
  name = "alex-stockcheck-bedrock"
  role = aws_iam_role.stockcheck.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
      # Inference profiles route across regions, same as the agents in 6_agents
      Resource = [
        "arn:aws:bedrock:*::foundation-model/*",
        "arn:aws:bedrock:*:*:inference-profile/*"
      ]
    }]
  })
}

resource "aws_lambda_function" "stockcheck" {
  count         = local.deployed ? 1 : 0
  function_name = "alex-stockcheck"
  role          = aws_iam_role.stockcheck.arn
  package_type  = "Image"
  image_uri     = var.stockcheck_image_uri
  architectures = ["x86_64"]
  timeout       = 60
  memory_size   = 1024

  environment {
    variables = {
      BEDROCK_MODEL_ID = var.bedrock_model_id
      BEDROCK_REGION   = var.bedrock_region
    }
  }

  tags = {
    Project = "alex"
    Part    = "9"
  }
}

resource "aws_lambda_function_url" "stockcheck" {
  count              = local.deployed ? 1 : 0
  function_name      = aws_lambda_function.stockcheck[0].function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.allowed_origins
    allow_methods = ["POST", "GET"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_lambda_permission" "public_url" {
  count                  = local.deployed ? 1 : 0
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.stockcheck[0].function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "public_invoke" {
  count                    = local.deployed ? 1 : 0
  statement_id             = "AllowPublicFunctionInvokeViaUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.stockcheck[0].function_name
  principal                = "*"
  invoked_via_function_url = true
}
