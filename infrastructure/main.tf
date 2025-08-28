# Created automatically by Cursor AI (2024-08-27)

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC and networking
module "vpc" {
  source = "./modules/vpc"
  
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
}

# RDS PostgreSQL with TimescaleDB
module "database" {
  source = "./modules/database"
  
  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  instance_class  = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  db_name         = var.db_name
  db_username     = var.db_username
  db_password     = var.db_password
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  node_type   = var.redis_node_type
  num_cache_nodes = var.redis_num_cache_nodes
}

# NATS messaging
module "nats" {
  source = "./modules/nats"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  key_name    = var.ec2_key_name
}

# S3 buckets
module "storage" {
  source = "./modules/storage"
  
  environment = var.environment
  bucket_names = var.s3_bucket_names
}

# Outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "redis_endpoint" {
  value = module.redis.endpoint
}

output "nats_endpoint" {
  value = module.nats.endpoint
}

output "s3_bucket_names" {
  value = module.storage.bucket_names
}
