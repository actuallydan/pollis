.PHONY: proto generate build run docker-build docker-run clean

# Generate gRPC code from proto files
proto:
	@echo "Generating gRPC code..."
	@cd .. && mkdir -p pkg/proto
	@cd .. && protoc --go_out=pkg/proto --go_opt=paths=source_relative \
		--go-grpc_out=pkg/proto --go-grpc_opt=paths=source_relative \
		--proto_path=pkg/proto \
		pkg/proto/pollis.proto
	@echo "Proto code generated in ../pkg/proto"

# Generate all code
generate: proto
	@echo "Code generation complete"

# Build the service
build: generate
	@echo "Building service..."
	@go build -o bin/server ./cmd/server

# Run the service locally
run: build
	@echo "Running service..."
	@./bin/server -port=50051 -db=libsql://file:./data/pollis-service.db

# Build Docker image (from parent directory)
docker-build:
	@echo "Building Docker image..."
	@cd .. && docker build -f service/Dockerfile -t pollis-service:latest .

# Run with Docker Compose
docker-run:
	@echo "Starting service with Docker Compose..."
	@docker-compose up -d

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf bin/
	@rm -rf data/
	@go clean

