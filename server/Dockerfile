# Build stage
# Build from repo root: docker build -f server/Dockerfile -t pollis-server:latest .

FROM golang:alpine AS builder

WORKDIR /app

# Install build dependencies including protoc
RUN apk add --no-cache git ca-certificates protobuf-dev

# Install Go protoc plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Allow Go to download the required toolchain version
ENV GOTOOLCHAIN=auto

# Copy go.mod files first for better caching
COPY pkg/proto/go.mod pkg/proto/go.sum* ./pkg/proto/
COPY server/go.mod server/go.sum ./server/

# Download dependencies
WORKDIR /app/server
RUN go mod download

# Copy proto file and generate Go code
WORKDIR /app
COPY pkg/proto/pollis.proto ./pkg/proto/
RUN protoc --go_out=pkg/proto --go_opt=paths=source_relative \
    --go-grpc_out=pkg/proto --go-grpc_opt=paths=source_relative \
    --proto_path=pkg/proto \
    pkg/proto/pollis.proto

# Copy server source code
COPY server ./server

# Build the server binary
WORKDIR /app/server
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -ldflags="-w -s" -o /server ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /server .

# Expose ports: gRPC (50051) and HTTP/gRPC-web (8081)
EXPOSE 50051 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

# Run the server
ENTRYPOINT ["./server"]
CMD ["-port=50051", "-http-port=8081"]
