#!/bin/bash
# Deploy server to VPS - run from repo root
# Usage: ./scripts/deploy-server.sh

set -e

# Load environment
if [ -f .env.local ]; then
    export $(grep -E '^(HOSTINGER_IP|HOSTINGER_PWD|TURSO_URL|TURSO_TOKEN)=' .env.local | xargs)
fi

VPS_HOST="${HOSTINGER_IP:?HOSTINGER_IP not set in .env.local}"
VPS_USER="${VPS_USER:-root}"
VPS_PWD="${HOSTINGER_PWD}"

echo "=== Deploying Pollis Server to $VPS_HOST ==="

# Build Docker image locally
echo "Building Docker image..."
docker build -f server/Dockerfile -t pollis-server:latest .

# Save and transfer image (avoids needing GHCR for manual deploys)
echo "Saving Docker image..."
docker save pollis-server:latest | gzip > /tmp/pollis-server.tar.gz

echo "Transferring to VPS..."
sshpass -p "$VPS_PWD" scp -o StrictHostKeyChecking=no /tmp/pollis-server.tar.gz "$VPS_USER@$VPS_HOST:~/pollis-server.tar.gz"

# Transfer deploy files
echo "Transferring deploy files..."
sshpass -p "$VPS_PWD" scp -o StrictHostKeyChecking=no deploy/docker-compose.yml deploy/Caddyfile "$VPS_USER@$VPS_HOST:~/"

# Create .env on VPS and start services
echo "Starting services on VPS..."
sshpass -p "$VPS_PWD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << EOF
set -e

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Load the image
echo "Loading Docker image..."
gunzip -c ~/pollis-server.tar.gz | docker load
rm ~/pollis-server.tar.gz

# Create .env file
cat > ~/.env << ENVEOF
TURSO_URL=${TURSO_URL}
TURSO_TOKEN=${TURSO_TOKEN}
ENVEOF

# Update docker-compose to use local image
sed -i 's|image: ghcr.io/actuallydan/pollis-server:latest|image: pollis-server:latest|' ~/docker-compose.yml

# Start services
cd ~
docker compose down 2>/dev/null || true
docker compose up -d

echo "Services started!"
docker compose ps
EOF

rm /tmp/pollis-server.tar.gz

echo ""
echo "=== Deployment Complete ==="
echo "API should be available at https://api.pollis.com (once DNS propagates)"
echo "Test with: curl https://api.pollis.com/health"
