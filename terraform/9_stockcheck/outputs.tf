output "ecr_repository_url" {
  value = aws_ecr_repository.stockcheck.repository_url
}

output "stockcheck_url" {
  description = "Public function URL - set as NEXT_PUBLIC_STOCKCHECK_URL for the frontend"
  value       = local.deployed ? aws_lambda_function_url.stockcheck[0].function_url : ""
}
