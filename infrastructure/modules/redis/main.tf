# Created automatically by Cursor AI (2024-08-27)

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.environment}-finance-tracker-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.environment}-finance-tracker-redis-subnet-group"
    Environment = var.environment
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.environment}-finance-tracker-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis_access.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-finance-tracker-redis-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "redis_access" {
  name_prefix = "${var.environment}-finance-tracker-redis-access-"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.environment}-finance-tracker-redis-access-sg"
    Environment = var.environment
  }
}

resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.environment}-finance-tracker-redis-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = {
    Name        = "${var.environment}-finance-tracker-redis-params"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.environment}-finance-tracker-redis"
  replication_group_description = "Finance Tracker Redis Cluster"

  node_type                  = var.node_type
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]

  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = var.num_cache_nodes > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Name        = "${var.environment}-finance-tracker-redis"
    Environment = var.environment
  }
}
