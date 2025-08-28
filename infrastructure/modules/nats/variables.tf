# Created automatically by Cursor AI (2024-08-27)

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for NATS"
  type        = list(string)
}

variable "key_name" {
  description = "EC2 key pair name"
  type        = string
  default     = ""
}
