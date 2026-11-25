variable "aws_region" {
  description = "AWS region for the stock check Lambda"
  type        = string
}

variable "bedrock_model_id" {
  description = "Bedrock model for the chat assistant"
  type        = string
  default     = "us.amazon.nova-pro-v1:0"
}

variable "bedrock_region" {
  description = "Region for Bedrock calls"
  type        = string
  default     = "us-west-2"
}

variable "allowed_origins" {
  description = "Frontend origins allowed to call the function URL (CloudFront URL + localhost)"
  type        = list(string)
}

variable "stockcheck_image_uri" {
  description = "ECR image URI, written by backend/stockcheck/deploy.py"
  type        = string
  default     = ""
}

variable "daily_check_limit" {
  description = "Stock checks allowed per visitor IP per day (server-side cap for the public URL)"
  type        = number
  default     = 60
}

variable "daily_chat_limit" {
  description = "Chat messages allowed per visitor IP per day (server-side cap for the public URL)"
  type        = number
  default     = 60
}
