# Pollis - E2E Encrypted Messaging App

An end-to-end encrypted desktop messaging application built with Wails (Go + React/TypeScript), designed to function like Slack but with full Signal protocol encryption.

![Pollis App](readme/app.png)

## Architecture

- **Desktop App**: Wails v2 application (Go backend + React frontend)
  - Local database: libSQL (SQLite) for user snapshots
  - Cross-platform: macOS, Linux, Windows
- **Server**: gRPC server for coordination and signaling
  - Database: Turso (libSQL remote)

## Development Setup

### Prerequisites

**All Platforms:**
- Go 1.24+
- Node.js 18+
- pnpm 10.25+
- Protocol Buffers compiler (`protoc`)
- Go protoc plugins:
  ```bash
  go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
  go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
  ```

**macOS:**
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Or via Homebrew: `brew install protobuf`

**Linux:**
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Install system dependencies for Wails: https://wails.io/docs/gettingstarted/installation#linux

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Generate gRPC code:
   ```bash
   pnpm proto
   ```

4. Set up Turso database (required for server):
   ```bash
   # Copy example env file
   cp .env.example .env.local

   # Edit .env.local and add your Turso credentials
   # Get free database at https://turso.tech
   ```

### Development

```bash
# Run desktop app (recommended for development)
pnpm dev

# Run only frontend in browser (no desktop app)
pnpm dev:frontend

# Run standalone server (optional, for testing)
pnpm dev:server
```

**Note:** The desktop app includes an embedded gRPC server. The standalone server is only needed for testing or running server-only deployments.

### Building

```bash
# Build for your current platform
pnpm build:app

# Platform-specific builds
make build-macos    # macOS universal binary (Intel + Apple Silicon)
make build-linux    # Linux amd64
make build-windows  # Windows amd64
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
