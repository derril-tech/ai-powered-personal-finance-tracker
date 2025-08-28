# Created automatically by Cursor AI (2024-08-27)

output "endpoint" {
  description = "Database endpoint"
  value       = aws_db_instance.main.endpoint
}

output "port" {
  description = "Database port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Database name"
  value       = aws_db_instance.main.db_name
}

output "security_group_id" {
  description = "Database security group ID"
  value       = aws_security_group.database.id
}

output "access_security_group_id" {
  description = "Database access security group ID"
  value       = aws_security_group.database_access.id
}
