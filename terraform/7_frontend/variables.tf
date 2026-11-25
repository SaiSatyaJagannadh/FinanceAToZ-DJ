variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

# Clerk validation happens in Lambda, not at API Gateway level
variable "clerk_jwks_url" {
  description = "Clerk JWKS URL for JWT validation in Lambda"
  type        = string
}

variable "clerk_issuer" {
  description = "Clerk issuer URL (kept for Lambda environment)"
  type        = string
  default     = ""  # Not actually used but kept for backwards compatibility
}
variable "bedrock_model_id" {
  description = "Bedrock model for the portfolio chat"
  type        = string
  default     = "us.amazon.nova-pro-v1:0"
}

variable "bedrock_region" {
  description = "Region for Bedrock calls from the API"
  type        = string
  default     = "us-west-2"
}

variable "chat_guardrail_id" {
  description = "Bedrock Guardrail for /api/chat, from `terraform output chat_guardrail_id` in 9_stockcheck. Empty disables it."
  type        = string
  default     = ""
}

variable "chat_guardrail_version" {
  description = "Guardrail version, from `terraform output chat_guardrail_version` in 9_stockcheck"
  type        = string
  default     = "DRAFT"
}
