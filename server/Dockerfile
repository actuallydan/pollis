# Build stage
# Note: This Dockerfile should be built from the parent directory (pollis)
# Example: docker build -f service/Dockerfile -t pollis-service:latest .

FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install protoc and dependencies
RUN apk add --no-cache protobuf protoc-gen-go protoc-gen-go-grpc

# Copy proto files from parent
COPY pkg/proto ./pkg/proto

# Copy service directory
COPY service/go.mod service/go.sum ./service/
WORKDIR /app/service

# Download dependencies
RUN go mod download

# Generate proto code
RUN protoc --go_out=../../pkg/proto --go_opt=paths=source_relative \
        --go-grpc_out=../../pkg/proto --go-grpc_opt=paths=source_relative \
        --proto_path=../../pkg/proto \
        ../../pkg/proto/pollis.proto

# Copy service source code
COPY service/ .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/server .

# Expose gRPC port
EXPOSE 50051

# Run the server
CMD ["./server", "-port=50051"]

