# Created automatically by Cursor AI (2024-12-19)

# S3 Bucket with prefix-based isolation
resource "aws_s3_bucket" "finance_data" {
  bucket = var.s3_bucket_name

  tags = {
    Name        = "Finance Data Bucket"
    Environment = var.environment
    Project     = "finance-tracker"
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "finance_data_versioning" {
  bucket = aws_s3_bucket.finance_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "finance_data_encryption" {
  bucket = aws_s3_bucket.finance_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "finance_data_public_access_block" {
  bucket = aws_s3_bucket.finance_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "finance_data_lifecycle" {
  bucket = aws_s3_bucket.finance_data.id

  rule {
    id     = "statements_retention"
    status = "Enabled"

    filter {
      prefix = "statements/"
    }

    expiration {
      days = 2555 # 7 years for statements
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "reports_retention"
    status = "Enabled"

    filter {
      prefix = "reports/"
    }

    expiration {
      days = 1825 # 5 years for reports
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "exports_retention"
    status = "Enabled"

    filter {
      prefix = "exports/"
    }

    expiration {
      days = 365 # 1 year for exports
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  rule {
    id     = "imports_retention"
    status = "Enabled"

    filter {
      prefix = "imports/"
    }

    expiration {
      days = 90 # 3 months for imports
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  rule {
    id     = "shared_retention"
    status = "Enabled"

    filter {
      prefix = "shared/"
    }

    expiration {
      days = 30 # 30 days for shared files
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }

  rule {
    id     = "backups_retention"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    expiration {
      days = 3650 # 10 years for backups
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "profiles_retention"
    status = "Enabled"

    filter {
      prefix = "profiles/"
    }

    expiration {
      days = 1825 # 5 years for profile pictures
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# S3 Bucket Policy for prefix-based access control
resource "aws_s3_bucket_policy" "finance_data_policy" {
  bucket = aws_s3_bucket.finance_data.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyUnencryptedObjectUploads"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.finance_data.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "DenyIncorrectEncryptionHeader"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.finance_data.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "DenyUnencryptedObjectUploads"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.finance_data.arn}/*"
        Condition = {
          Null = {
            "s3:x-amz-server-side-encryption" = "true"
          }
        }
      }
    ]
  })
}

# IAM Role for application access to S3
resource "aws_iam_role" "s3_access_role" {
  name = "${var.environment}-finance-s3-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = "finance-tracker"
  }
}

# IAM Policy for S3 access with prefix isolation
resource "aws_iam_policy" "s3_access_policy" {
  name        = "${var.environment}-finance-s3-access-policy"
  description = "Policy for finance application S3 access with prefix isolation"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StatementsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/statements/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "ReportsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/reports/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "ExportsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/exports/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "ImportsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/imports/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "SharedAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/shared/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "BackupsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/backups/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "ProfilesAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.finance_data.arn}/profiles/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid    = "ListBucket"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.finance_data.arn
        ]
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "statements/*",
              "reports/*",
              "exports/*",
              "imports/*",
              "shared/*",
              "backups/*",
              "profiles/*"
            ]
          }
        }
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "s3_access_policy_attachment" {
  role       = aws_iam_role.s3_access_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}

# CloudWatch Logs for S3 access
resource "aws_cloudwatch_log_group" "s3_access_logs" {
  name              = "/aws/s3/${var.s3_bucket_name}/access-logs"
  retention_in_days = 90

  tags = {
    Environment = var.environment
    Project     = "finance-tracker"
  }
}

# S3 Bucket for access logs
resource "aws_s3_bucket" "access_logs" {
  bucket = "${var.s3_bucket_name}-access-logs"

  tags = {
    Name        = "Finance Access Logs"
    Environment = var.environment
    Project     = "finance-tracker"
  }
}

# S3 Bucket Public Access Block for access logs
resource "aws_s3_bucket_public_access_block" "access_logs_public_access_block" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Server-Side Encryption for access logs
resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs_encryption" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Lifecycle for access logs
resource "aws_s3_bucket_lifecycle_configuration" "access_logs_lifecycle" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    id     = "access_logs_retention"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Enable access logging on main bucket
resource "aws_s3_bucket_logging" "finance_data_logging" {
  bucket = aws_s3_bucket.finance_data.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "finance-data/"
}

# Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.finance_data.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.finance_data.arn
}

output "s3_access_role_arn" {
  description = "ARN of the S3 access role"
  value       = aws_iam_role.s3_access_role.arn
}
