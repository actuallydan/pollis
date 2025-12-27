.PHONY: proto generate build dev

# Generate gRPC code from proto files
proto:
	@echo "Generating gRPC code..."
	@mkdir -p pkg/proto
	@PATH="$$HOME/go/bin:$$PATH" protoc --go_out=pkg/proto --go_opt=paths=source_relative \
		--go-grpc_out=pkg/proto --go-grpc_opt=paths=source_relative \
		--proto_path=pkg/proto \
		pkg/proto/pollis.proto

# Generate all code
generate: proto
	@echo "Code generation complete"

# Build the application (use pnpm build:app instead)
build:
	@echo "Use 'pnpm build:app' to build the Wails app"
	@PATH="$$HOME/go/bin:$$PATH" wails build || echo "Wails not found in PATH. Install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"

# Build for Windows (amd64)
build-windows:
	@echo "Building Wails app for Windows (amd64)..."
	@PATH="$$HOME/go/bin:$$PATH" wails build -platform windows/amd64 || echo "Wails not found in PATH. Install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"

# Build for macOS universal (amd64 + arm64)
build-macos:
	@echo "Building Wails app for macOS (amd64 + arm64 universal)..."
	@PATH="$$HOME/go/bin:$$PATH" wails build -platform darwin/universal || echo "Wails not found in PATH. Install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"

# Build for Linux (amd64)
build-linux:
	@echo "Building Wails app for Linux (amd64)..."
	@PATH="$$HOME/go/bin:$$PATH" wails build -platform linux/amd64 || echo "Wails not found in PATH. Install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"

# Run in development mode (use pnpm dev instead)
dev:
	@echo "Use 'pnpm dev' to run development servers"
	@PATH="$$HOME/go/bin:$$PATH" wails dev || echo "Wails not found in PATH. Install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"

