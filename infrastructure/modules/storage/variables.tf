# Created automatically by Cursor AI (2024-08-27)

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "bucket_names" {
  description = "S3 bucket names"
  type        = list(string)
}
