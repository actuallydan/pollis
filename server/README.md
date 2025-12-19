# Pollis Service

gRPC service for Pollis E2E encrypted messaging application.

## Overview

This service provides the remote coordination layer for the Pollis desktop app. It handles:

- User metadata storage
- Group and channel management
- Key exchange message routing
- WebRTC signaling (for future voice channels)

**Important**: This service does NOT store encrypted message content. All messages are stored locally in the desktop app. The service only stores metadata and routes key exchange messages.

## Architecture

- **Database**: libSQL/Turso (SQLite-compatible)
- **Protocol**: gRPC
- **Language**: Go 1.24+

## Setup

### Prerequisites

- Go 1.24+
- Protocol Buffers compiler (`protoc`)
- Go plugins for protoc:
  - `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`
  - `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest`

### Local Development

1. Generate proto code:

```bash
make proto
```

2. Build the service:

```bash
make build
```

3. Run the service:

```bash
make run
```

Or run directly:

```bash
go run ./cmd/server -port=50051 -db=libsql://file:./data/pollis-service.db
```

### Docker

Build and run with Docker Compose:

```bash
make docker-build
make docker-run
```

Or manually:

```bash
docker build -t pollis-service:latest .
docker run -p 50051:50051 -e DB_URL=libsql://file:./data/pollis-service.db pollis-service:latest
```

## Configuration

### Environment Variables

- `DB_URL`: Database connection string
  - Local file: `libsql://file:./data/pollis-service.db`
  - Turso: `libsql://host:port?authToken=...`

### Command Line Flags

- `-port`: gRPC server port (default: 50051)
- `-db`: Database URL (required)
- `-reflection`: Enable gRPC reflection (default: true)

## Database

The service uses libSQL/Turso for metadata storage. The database schema includes:

- Users (metadata only)
- Groups
- Group members
- Channels
- Key exchange messages
- WebRTC signaling messages

Migrations are automatically applied on startup.

## Deployment

### Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Create app: `fly apps create pollis-service`
4. Set secrets:
   ```bash
   fly secrets set DB_URL="libsql://your-turso-url?authToken=..."
   ```
5. Deploy: `fly deploy`

### Hostinger

1. Build Docker image
2. Push to container registry
3. Deploy using Hostinger's container hosting

## API

The service implements the `PollisService` gRPC service defined in `../pkg/proto/pollis.proto`.

### User Management

- `RegisterUser`: Register or update user metadata
- `GetUser`: Get user by identifier (username/email/phone)
- `SearchUsers`: Search for users

### Group Management

- `CreateGroup`: Create a new group
- `GetGroup`: Get group details with members
- `SearchGroup`: Search for group by slug (only returns if user is member)
- `InviteToGroup`: Add user to group
- `ListUserGroups`: List all groups for a user

### Channel Management

- `CreateChannel`: Create a channel in a group
- `ListChannels`: List all channels in a group

### Key Exchange

- `SendKeyExchange`: Send encrypted key exchange message
- `GetKeyExchangeMessages`: Retrieve key exchange messages for a user
- `MarkKeyExchangeRead`: Delete key exchange messages (mark as read)

### WebRTC Signaling

- `SendWebRTCSignal`: Send WebRTC signaling message
- `GetWebRTCSignals`: Retrieve WebRTC signals for a user

## Security

- All communication over TLS (configure in deployment)
- Service does not see plaintext messages (only encrypted blobs)
- Key exchange messages expire automatically
- No authentication in MVP (trust-based)

## Development

### Project Structure

```
service/
├── cmd/
│   └── server/
│       └── main.go          # Entry point
├── internal/
│   ├── database/
│   │   ├── libsql.go        # Database connection
│   │   └── migrations/      # SQL migrations
│   ├── handlers/
│   │   └── pollis_handler.go # gRPC handlers
│   ├── models/
│   │   └── models.go       # Data models
│   ├── services/
│   │   ├── user_service.go
│   │   ├── group_service.go
│   │   ├── channel_service.go
│   │   ├── key_exchange_service.go
│   │   └── webrtc_service.go
│   └── utils/
│       ├── ulid.go
│       └── timestamp.go
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── README.md
```

## Testing

```bash
# Run tests
go test ./...

# Test with grpcurl (if installed)
grpcurl -plaintext localhost:50051 list
grpcurl -plaintext localhost:50051 pollis.PollisService/GetUser
```

## License

Same as main project.
