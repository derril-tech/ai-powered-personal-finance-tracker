# Created automatically by Cursor AI (2024-08-27)

output "bucket_names" {
  description = "S3 bucket names"
  value       = [for bucket in aws_s3_bucket.main : bucket.bucket]
}

output "bucket_arns" {
  description = "S3 bucket ARNs"
  value       = [for bucket in aws_s3_bucket.main : bucket.arn]
}
