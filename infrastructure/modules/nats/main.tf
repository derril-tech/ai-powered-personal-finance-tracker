# Created automatically by Cursor AI (2024-08-27)

resource "aws_security_group" "nats" {
  name_prefix = "${var.environment}-finance-tracker-nats-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 4222
    to_port         = 4222
    protocol        = "tcp"
    security_groups = [aws_security_group.nats_access.id]
  }

  ingress {
    from_port       = 8222
    to_port         = 8222
    protocol        = "tcp"
    security_groups = [aws_security_group.nats_access.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-finance-tracker-nats-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "nats_access" {
  name_prefix = "${var.environment}-finance-tracker-nats-access-"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.environment}-finance-tracker-nats-access-sg"
    Environment = var.environment
  }
}

# For production, you would use ECS/Fargate or EKS to run NATS
# For development, we'll use a simple EC2 instance
resource "aws_instance" "nats" {
  count = var.environment == "production" ? 0 : 1

  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  subnet_id     = var.subnet_ids[0]

  vpc_security_group_ids = [aws_security_group.nats.id]
  key_name               = var.key_name

  user_data = templatefile("${path.module}/user_data.sh", {
    cluster_name = "${var.environment}-finance-tracker-cluster"
    cluster_id   = "${var.environment}-finance-tracker-cluster-id"
  })

  tags = {
    Name        = "${var.environment}-finance-tracker-nats"
    Environment = var.environment
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
