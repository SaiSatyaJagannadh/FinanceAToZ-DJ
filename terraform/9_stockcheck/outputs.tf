output "ecr_repository_url" {
  value = aws_ecr_repository.stockcheck.repository_url
}

output "stockcheck_url" {
  description = "Public function URL - set as NEXT_PUBLIC_STOCKCHECK_URL for the frontend"
  value       = local.deployed ? aws_lambda_function_url.stockcheck[0].function_url : ""
}

output "chat_guardrail_id" {
  description = "Bedrock Guardrail for both chats; copy into terraform/7_frontend/terraform.tfvars as chat_guardrail_id"
  value       = aws_bedrock_guardrail.chat.guardrail_id
}

output "chat_guardrail_version" {
  value = aws_bedrock_guardrail_version.chat.version
}
