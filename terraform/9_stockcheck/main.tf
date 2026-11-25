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

# Guardrails must live in the Bedrock region the chats call
provider "aws" {
  alias  = "bedrock"
  region = var.bedrock_region
}

data "aws_caller_identity" "current" {}

# Amazon Bedrock Guardrail shared by both chats (this public chat and the signed-in /api/chat in 7_frontend).
# PROMPT_ATTACK blocks jailbreak / prompt-injection attempts in the user's message;
# the content filters block harmful requests and replies. Billed per text unit, only when a chat runs.
resource "aws_bedrock_guardrail" "chat" {
  provider                  = aws.bedrock
  name                      = "alex-chat-guardrail"
  blocked_input_messaging   = "I can't help with that. Ask me about investing, your portfolio or a stock check."
  blocked_outputs_messaging = "I can't share that answer. Try asking about investing, your portfolio or a stock check."

  content_policy_config {
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE"
    }
    dynamic "filters_config" {
      for_each = ["HATE", "INSULTS", "SEXUAL", "VIOLENCE", "MISCONDUCT"]
      content {
        type            = filters_config.value
        input_strength  = "HIGH"
        output_strength = "HIGH"
      }
    }
  }

  tags = {
    Project = "alex"
    Part    = "9"
  }
}

resource "aws_bedrock_guardrail_version" "chat" {
  provider      = aws.bedrock
  guardrail_arn = aws_bedrock_guardrail.chat.guardrail_arn
  description   = "Managed by terraform/9_stockcheck"
}

# Per-visitor daily counters for the free tier (the frontend's 3-check limit is client-side only).
# Pay-per-request with TTL cleanup, so it costs effectively nothing.
resource "aws_dynamodb_table" "usage" {
  name         = "alex-stockcheck-usage"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = {
    Project = "alex"
    Part    = "9"
  }
}

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

resource "aws_iam_role_policy" "stockcheck_guardrail_usage" {
  name = "alex-stockcheck-guardrail-usage"
  role = aws_iam_role.stockcheck.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["bedrock:ApplyGuardrail"]
        Resource = [aws_bedrock_guardrail.chat.guardrail_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem"]
        Resource = [aws_dynamodb_table.usage.arn]
      }
    ]
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
      BEDROCK_MODEL_ID          = var.bedrock_model_id
      BEDROCK_REGION            = var.bedrock_region
      BEDROCK_GUARDRAIL_ID      = aws_bedrock_guardrail.chat.guardrail_id
      BEDROCK_GUARDRAIL_VERSION = aws_bedrock_guardrail_version.chat.version
      USAGE_TABLE               = aws_dynamodb_table.usage.name
      DAILY_CHECK_LIMIT         = var.daily_check_limit
      DAILY_CHAT_LIMIT          = var.daily_chat_limit
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
