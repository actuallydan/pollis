#!/bin/bash
# Generate proto code for the service
# This script should be run from the service directory

set -e

echo "Generating gRPC code from proto files..."

# Navigate to parent directory to access proto files
cd "$(dirname "$0")/../.."

# Ensure proto directory exists
mkdir -p pkg/proto

# Generate proto code
protoc --go_out=pkg/proto --go_opt=paths=source_relative \
    --go-grpc_out=pkg/proto --go-grpc_opt=paths=source_relative \
    --proto_path=pkg/proto \
    pkg/proto/pollis.proto

echo "Proto code generated successfully!"

