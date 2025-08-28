#!/bin/bash
# Created automatically by Cursor AI (2024-08-27)

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create NATS configuration
mkdir -p /opt/nats
cat > /opt/nats/docker-compose.yml << EOF
version: '3.8'
services:
  nats:
    image: nats:2-alpine
    container_name: nats-server
    ports:
      - "4222:4222"
      - "8222:8222"
    command: >
      nats-server
      --jetstream
      --cluster_name ${cluster_name}
      --cluster_id ${cluster_id}
    restart: unless-stopped
EOF

# Start NATS
cd /opt/nats
docker-compose up -d
