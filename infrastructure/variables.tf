# Created automatically by Cursor AI (2024-08-27)

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "development"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "finance_tracker"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of ElastiCache nodes"
  type        = number
  default     = 1
}

variable "ec2_key_name" {
  description = "EC2 key pair name for NATS instance"
  type        = string
  default     = ""
}

variable "s3_bucket_names" {
  description = "S3 bucket names"
  type        = list(string)
  default     = [
    "finance-tracker-statements",
    "finance-tracker-exports",
    "finance-tracker-bundles"
  ]
}
