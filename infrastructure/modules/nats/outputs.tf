# Created automatically by Cursor AI (2024-08-27)

output "endpoint" {
  description = "NATS endpoint"
  value       = var.environment == "production" ? "nats://nats-cluster.internal:4222" : aws_instance.nats[0].private_ip
}

output "port" {
  description = "NATS port"
  value       = 4222
}

output "security_group_id" {
  description = "NATS security group ID"
  value       = aws_security_group.nats.id
}

output "access_security_group_id" {
  description = "NATS access security group ID"
  value       = aws_security_group.nats_access.id
}
