# Pollis - E2E Encrypted Messaging App

An end-to-end encrypted desktop messaging application built with Wails (Go + React/TypeScript), designed to function like Slack but with full Signal protocol encryption.

## Architecture

- **Desktop App**: Wails v2 application (Go backend + React frontend)
- **Service**: gRPC server for coordination and signaling
- **Database**: libSQL (local) and libSQL/Turso (service)

## Development Setup

### Prerequisites

- Go 1.24+
- Node.js 18+
- pnpm 10.25+
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Protocol Buffers compiler: `protoc`

### Installation

```bash
# Install dependencies
pnpm install

# Generate gRPC code (if proto files changed)
pnpm proto
```

### Development

```bash
# Run desktop app + gRPC service (full development)
pnpm dev

# Run only the Wails desktop app
pnpm dev:app

# Run only the gRPC service
pnpm dev:service

# Run only frontend in browser (no desktop app)
pnpm dev:frontend

# Build Wails desktop app
pnpm build:app
```

### Service Configuration

The service requires a database URL. Set it via environment variable:

```bash
# Local file-based database (default)
pnpm dev --filter=service

# Local file with custom path
DB_URL=./custom-path.db pnpm dev --filter=service

# Turso cloud database
DB_URL=libsql://your-db.turso.io?authToken=your-token pnpm dev --filter=service
```

Default is `./service.db` (local SQLite file) if not specified.

### Building

```bash
# Build all packages
pnpm build

# Build desktop app
pnpm build:app
```

## Project Structure

```
pollis/
├── frontend/          # React frontend
├── service/           # gRPC service
├── internal/          # Desktop app Go code
├── pkg/proto/         # Shared gRPC proto definitions
└── app.go, main.go    # Wails app entry points
```

## See Also

- [SPEC.md](SPEC.md) - Full specification document
