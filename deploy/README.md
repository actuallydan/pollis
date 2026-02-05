# Pollis Server Deployment

## Prerequisites

- Docker and Docker Compose installed on your VPS
- Domain `api.pollis.com` pointing to your VPS IP address
- Turso database credentials

## Quick Start

1. SSH into your VPS:
   ```bash
   ssh user@your-vps-ip
   ```

2. Clone the repo (or copy the deploy folder):
   ```bash
   git clone https://github.com/actuallydan/pollis.git
   cd pollis/deploy
   ```

3. Create `.env` from the example:
   ```bash
   cp .env.example .env
   # Edit .env with your Turso credentials
   ```

4. Start the services:
   ```bash
   docker compose up -d
   ```

5. Check logs:
   ```bash
   docker compose logs -f
   ```

## Updating

Pull the latest image and restart:
```bash
docker compose pull
docker compose up -d
```

## DNS Setup

Add an A record for `api.pollis.com` pointing to your VPS IP:
- Type: A
- Name: api
- Value: YOUR_VPS_IP
- TTL: 300 (or auto)

Caddy will automatically provision TLS certificates once DNS propagates.

## Ports

- 80: HTTP (redirects to HTTPS)
- 443: HTTPS (API endpoint)
- 50051: gRPC (internal, not exposed by default)
- 8081: gRPC-web/HTTP (internal, proxied via Caddy)

## Troubleshooting

Check if services are running:
```bash
docker compose ps
```

View server logs:
```bash
docker compose logs server
```

View Caddy logs:
```bash
docker compose logs caddy
```

Test health endpoint:
```bash
curl https://api.pollis.com/health
```
