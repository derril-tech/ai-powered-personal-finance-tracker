# Created automatically by Cursor AI (2024-08-27)

resource "aws_s3_bucket" "main" {
  for_each = toset(var.bucket_names)
  
  bucket = "${var.environment}-${each.value}"

  tags = {
    Name        = "${var.environment}-${each.value}"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "main" {
  for_each = aws_s3_bucket.main
  
  bucket = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  for_each = aws_s3_bucket.main
  
  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  for_each = aws_s3_bucket.main
  
  bucket = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "main" {
  for_each = aws_s3_bucket.main
  
  bucket = each.value.id

  rule {
    id     = "cleanup_old_versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
