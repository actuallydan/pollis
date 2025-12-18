# Testing Guide

This document describes how to test the Pollis service.

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

## Running the Service

### Local Development

```bash
# Start with local SQLite database
./bin/server -port=50051 -db=./data/pollis-service.db

# Or with Turso
./bin/server -port=50051 -db="libsql://your-turso-url?authToken=..."
```

### Using Docker

```bash
docker-compose up
```

## Testing with grpcurl

Install grpcurl:

```bash
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
```

### List Services

```bash
grpcurl -plaintext localhost:50051 list
```

### Test User Registration

```bash
grpcurl -plaintext -d '{
  "user_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "username": "testuser",
  "email": "test@example.com",
  "public_key": "dGVzdA=="
}' localhost:50051 pollis.PollisService/RegisterUser
```

### Test Get User

```bash
grpcurl -plaintext -d '{
  "user_identifier": "testuser"
}' localhost:50051 pollis.PollisService/GetUser
```

### Test Search Users

```bash
grpcurl -plaintext -d '{
  "query": "test",
  "limit": 10
}' localhost:50051 pollis.PollisService/SearchUsers
```

### Test Create Group

```bash
grpcurl -plaintext -d '{
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "slug": "test-group",
  "name": "Test Group",
  "description": "A test group",
  "created_by": "testuser"
}' localhost:50051 pollis.PollisService/CreateGroup
```

### Test Search Group

```bash
grpcurl -plaintext -d '{
  "slug": "test-group",
  "user_identifier": "testuser"
}' localhost:50051 pollis.PollisService/SearchGroup
```

### Test Invite to Group

```bash
grpcurl -plaintext -d '{
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "user_identifier": "anotheruser",
  "invited_by": "testuser"
}' localhost:50051 pollis.PollisService/InviteToGroup
```

### Test Create Channel

```bash
grpcurl -plaintext -d '{
  "channel_id": "01ARZ3NDEKTSV4RRFFQ69G5FAX",
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "name": "general",
  "description": "General discussion",
  "created_by": "testuser"
}' localhost:50051 pollis.PollisService/CreateChannel
```

### Test List Channels

```bash
grpcurl -plaintext -d '{
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW"
}' localhost:50051 pollis.PollisService/ListChannels
```

### Test Send Key Exchange

```bash
grpcurl -plaintext -d '{
  "from_user_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "to_user_identifier": "anotheruser",
  "message_type": "prekey_bundle",
  "encrypted_data": "dGVzdA==",
  "expires_in_seconds": 3600
}' localhost:50051 pollis.PollisService/SendKeyExchange
```

### Test Get Key Exchange Messages

```bash
grpcurl -plaintext -d '{
  "user_identifier": "anotheruser"
}' localhost:50051 pollis.PollisService/GetKeyExchangeMessages
```

## Testing Authorization

### Test Unauthorized Invite (should fail)

Try to invite to a group you're not a member of:

```bash
grpcurl -plaintext -d '{
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "user_identifier": "someuser",
  "invited_by": "nonmember"
}' localhost:50051 pollis.PollisService/InviteToGroup
```

Expected: Error message indicating only group members can invite.

### Test Unauthorized Channel Creation (should fail)

Try to create a channel in a group you're not a member of:

```bash
grpcurl -plaintext -d '{
  "channel_id": "01ARZ3NDEKTSV4RRFFQ69G5FAY",
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "name": "private",
  "created_by": "nonmember"
}' localhost:50051 pollis.PollisService/CreateChannel
```

Expected: Error message indicating only group members can create channels.

## Testing Validation

### Test Invalid User ID (should fail)

```bash
grpcurl -plaintext -d '{
  "user_id": "invalid",
  "username": "test",
  "public_key": "dGVzdA=="
}' localhost:50051 pollis.PollisService/RegisterUser
```

Expected: Validation error for invalid ULID.

### Test Invalid Group Slug (should fail)

```bash
grpcurl -plaintext -d '{
  "group_id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "slug": "INVALID_SLUG",
  "name": "Test",
  "created_by": "testuser"
}' localhost:50051 pollis.PollisService/CreateGroup
```

Expected: Validation error for invalid slug format.

## Concurrent Request Testing

Use a tool like `hey` or `ab` to test concurrent requests:

```bash
# Install hey
go install github.com/rakyll/hey@latest

# Test concurrent user registrations
hey -n 100 -c 10 -m POST -H "Content-Type: application/json" \
  -d '{"user_id":"01ARZ3NDEKTSV4RRFFQ69G5FAV","username":"test","public_key":"dGVzdA=="}' \
  http://localhost:50051/pollis.PollisService/RegisterUser
```

Note: For gRPC, you'll need a gRPC load testing tool like `ghz`:

```bash
go install github.com/bojand/ghz@latest

ghz --insecure --proto ../pkg/proto/pollis.proto \
  --call pollis.PollisService/GetUser \
  -d '{"user_identifier":"testuser"}' \
  localhost:50051
```

## Database Verification

Check the database directly:

```bash
# For SQLite
sqlite3 data/pollis-service.db

# Then run queries:
.tables
SELECT * FROM users;
SELECT * FROM groups;
SELECT * FROM group_members;
SELECT * FROM channels;
```

## Performance Testing

Monitor the service during load testing:

1. Check database connection pool
2. Monitor memory usage
3. Check response times
4. Verify data consistency

## Cleanup

To reset the database:

```bash
rm -rf data/
mkdir -p data
# Restart the service to recreate the database
```
