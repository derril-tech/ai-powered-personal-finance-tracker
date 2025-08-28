# Created automatically by Cursor AI (2024-08-27)

resource "aws_db_subnet_group" "main" {
  name       = "${var.environment}-finance-tracker-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.environment}-finance-tracker-db-subnet-group"
    Environment = var.environment
  }
}

resource "aws_security_group" "database" {
  name_prefix = "${var.environment}-finance-tracker-db-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database_access.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-finance-tracker-db-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "database_access" {
  name_prefix = "${var.environment}-finance-tracker-db-access-"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.environment}-finance-tracker-db-access-sg"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.environment}-finance-tracker-db"

  engine         = "postgres"
  engine_version = "16.1"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 2
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = true
  deletion_protection = false

  parameter_group_name = aws_db_parameter_group.main.name

  tags = {
    Name        = "${var.environment}-finance-tracker-db"
    Environment = var.environment
  }
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.environment}-finance-tracker-db-params"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "timescaledb,vector"
  }

  parameter {
    name  = "timescaledb.license"
    value = "apache"
  }

  tags = {
    Name        = "${var.environment}-finance-tracker-db-params"
    Environment = var.environment
  }
}
