# Deployment Guide

This guide covers deploying the Pollis service to various platforms.

## Prerequisites

1. Generate proto code:

```bash
cd service
make proto
```

2. Build the service:

```bash
make build
```

## Local Development

### Using Make

```bash
make run
```

### Manual

```bash
go run ./cmd/server -port=50051 -db=libsql://file:./data/pollis-service.db
```

## Docker Deployment

### Build Image

From the service directory:

```bash
cd ..
docker build -f service/Dockerfile -t pollis-service:latest .
```

Or use the Makefile:

```bash
cd service
make docker-build
```

### Run Container

```bash
docker run -p 50051:50051 \
  -e DB_URL="libsql://file:./data/pollis-service.db" \
  -v $(pwd)/data:/root/data \
  pollis-service:latest
```

### Docker Compose

```bash
cd service
docker-compose up -d
```

## Fly.io Deployment

### Initial Setup

1. Install Fly CLI:

```bash
curl -L https://fly.io/install.sh | sh
```

2. Login:

```bash
fly auth login
```

3. Create app:

```bash
fly apps create pollis-service
```

4. Set database URL (Turso):

```bash
fly secrets set DB_URL="libsql://your-turso-host:port?authToken=YOUR_TOKEN"
```

5. Deploy:

```bash
fly deploy
```

### Update Secrets

```bash
fly secrets set DB_URL="libsql://new-url?authToken=NEW_TOKEN"
```

### View Logs

```bash
fly logs
```

### Scale

```bash
fly scale count 2  # Run 2 instances
```

## Hostinger Deployment

1. Build Docker image
2. Push to container registry (Docker Hub, GitHub Container Registry, etc.)
3. Configure Hostinger container hosting:
   - Set image: `your-registry/pollis-service:latest`
   - Set port: `50051`
   - Set environment variable: `DB_URL=libsql://your-turso-url?authToken=...`
   - Configure health checks

## Database Setup

### Local libSQL

```bash
# Create data directory
mkdir -p data

# Run service with local database
./server -db=libsql://file:./data/pollis-service.db
```

### Turso (Recommended for Production)

1. Create Turso account: https://turso.tech
2. Create database:

```bash
turso db create pollis-service
```

3. Get connection URL:

```bash
turso db show pollis-service
```

4. Get auth token:

```bash
turso db tokens create pollis-service
```

5. Use in service:

```bash
DB_URL="libsql://pollis-service-org.turso.io:3306?authToken=YOUR_TOKEN"
```

## Environment Variables

- `DB_URL`: Database connection string (required)
  - Local: `libsql://file:./data/pollis-service.db`
  - Turso: `libsql://host:port?authToken=...`
- `PORT`: Server port (default: 50051)

## Health Checks

The service exposes a gRPC endpoint on port 50051. For health checks:

```bash
# Using grpc_health_probe
grpc_health_probe -addr=localhost:50051

# Or use gRPC reflection to list services
grpcurl -plaintext localhost:50051 list
```

## TLS/SSL Configuration

For production, configure TLS:

1. Obtain SSL certificates
2. Update server to use TLS:

```go
creds, err := credentials.NewServerTLSFromFile("cert.pem", "key.pem")
grpcServer := grpc.NewServer(grpc.Creds(creds))
```

3. Update client connections to use TLS

## Monitoring

### Logs

- Application logs are written to stdout/stderr
- Use your platform's log aggregation (Fly.io logs, Hostinger logs, etc.)

### Metrics

Consider adding:

- Prometheus metrics endpoint
- gRPC metrics middleware
- Database connection pool metrics

## Backup

### Database Backup

For Turso:

```bash
turso db backup create pollis-service
```

For local:

```bash
cp data/pollis-service.db data/pollis-service.db.backup
```

## Troubleshooting

### Connection Issues

1. Verify database URL is correct
2. Check network connectivity
3. Verify auth token (for Turso)

### Migration Issues

- Check migration logs in database
- Verify migration files are present
- Check database permissions

### Performance

- Monitor database connection pool
- Check query performance
- Consider database indexes
