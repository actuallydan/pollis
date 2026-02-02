# Pollis Architecture

**Signal's End-to-End Encryption + Slack's Group Features**

## Core Philosophy

Pollis is a privacy-first group messaging app that combines Signal's security model with Slack's organizational features.

### Key Principles

1. **End-to-End Encryption**: All message content encrypted using Signal Protocol
2. **Zero-Knowledge Server**: Server never sees message plaintext
3. **Network-First for Metadata**: Groups, channels, users fetched from remote DB
4. **Local-Only for Secrets**: Messages and keys never leave device

---

## Data Storage Architecture

### Remote Database (Turso/libSQL)

**Purpose**: Coordinate connections, manage groups/channels, store public metadata

**Stores**:
- Users (id, clerk_id, username, email, phone, avatar_url)
- Groups (id, slug, name, description, created_by)
- Channels (id, group_id, slug, name, description, channel_type)
- Group membership (group_id, user_id, role, joined_at)
- Public keys for key exchange (identity keys, prekeys)
- Key exchange messages (for establishing sessions)
- Message envelopes (for offline delivery, encrypted)

**Never Stores**:
- Message plaintext
- Private keys
- Decrypted content

### Local Database (SQLite)

**Purpose**: Store encrypted messages and cryptographic state

**Stores**:
- Messages (ciphertext, nonce, metadata)
- Private keys (encrypted at rest)
- Session state (Signal protocol sessions)
- Message queue (for offline sending)

**Never Stores**:
- Decrypted message content (only in memory)
- User profiles, groups, channels (fetched from remote)

---

## Frontend Data Flow

### Network-First with React Query

All non-encrypted data is fetched from the remote DB using React Query:

```typescript
// User profile data
const { data: userData } = useUserProfile();

// Groups the user belongs to
const { data: groups } = useUserGroups();

// Channels in a group
const { data: channels } = useGroupChannels(groupId);

// Messages (encrypted, from local DB)
const { data: messages } = useChannelMessages(channelId);
```

### Benefits

- Automatic caching and deduplication
- Automatic refetching on window focus
- Built-in loading/error states
- Optimistic updates
- Cache invalidation on mutations

### In-Memory Cache

Zustand store provides:
- Current user reference (just ID + ClerkID)
- UI state (selected group, channel, conversation)
- Temporary data for current session

---

## Authentication Flow

```
User Login
    ↓
Clerk OAuth (Google/GitHub/Email)
    ↓
Desktop App receives Clerk token
    ↓
Backend: RegisterUser(userID, clerkID, username, email, phone)
    ↓
Turso: Store user metadata
    ↓
Desktop: Create local DB for encrypted messages
    ↓
Frontend: Fetch user data via useUserProfile()
    ↓
Ready to use app
```

---

## Message Encryption Flow

### Sending a Message

```
1. User types message in UI
2. Frontend: Encrypt with Signal protocol
   - Get session key for conversation
   - Encrypt plaintext → ciphertext + nonce
3. Store locally in messages table (encrypted)
4. Send ciphertext to server via gRPC
5. Server: Store in message_envelope for delivery
6. Recipients: Fetch envelope, decrypt locally
```

### Key Exchange (X3DH)

```
1. Alice wants to message Bob
2. Alice → Server: "Get Bob's prekey bundle"
3. Server → Alice: {identity_key, signed_prekey, one_time_prekey}
4. Alice: Derive shared secret using X3DH
5. Alice: Create session, encrypt first message
6. Alice → Server: Send encrypted message
7. Bob: Receive, derive shared secret, decrypt
8. Both: Now have established session
```

---

## Type Safety

### TypeScript Types Match Server Schema

All TypeScript interfaces in `/frontend/src/types/index.ts` are documented with:
- Where data is stored (Remote vs Local)
- Which React Query hook fetches it
- Security notes (encrypted, never persisted, etc.)

### Example

```typescript
export interface Message {
  // Stored in: Local DB (encrypted)
  // Fetched via: useChannelMessages()
  // CRITICAL: Encrypted content NEVER leaves device in plaintext
  id: string;
  ciphertext: Uint8Array; // Signal protocol encrypted
  nonce: Uint8Array;
  content_decrypted?: string; // In-memory only, never persisted
  // ...
}
```

---

## Database Schemas

### Remote Schema (Turso)

See: `/server/internal/database/migrations/`

Key tables:
- `users` - User accounts (id, clerk_id, username, email, phone, avatar_url)
- `groups` - Groups/organizations
- `channel` - Text/voice channels within groups
- `group_member` - Group membership (user_id is ULID, not identifier!)
- `identity_key`, `signed_prekey`, `one_time_prekey` - Public keys for X3DH
- `message_envelope` - Encrypted message envelopes for delivery

### Local Schema (Desktop)

See: `/internal/database/migrations/`

Key tables:
- `message` - Encrypted messages (ciphertext, nonce, metadata)
- `identity_keys` - Private keys (encrypted at rest)
- `sessions` - Signal protocol session state
- `message_queue` - Pending outgoing messages

**Note**: Local schema should NOT have users, groups, channels tables. Those are fetched from remote.

---

## Migration Strategy

### Applying Migrations

Migrations run automatically on server startup:

```go
// server/internal/database/libsql.go
func (db *DB) migrate() error {
  // Reads migrations/*.sql files
  // Tracks applied migrations in schema_migrations table
  // Runs pending migrations in order
}
```

### Adding a Migration

1. Create new file: `003_description.sql` in migrations directory
2. Write SQL (CREATE, ALTER, etc.)
3. Restart server - migration runs automatically
4. Verify in schema_migrations table

### Resetting Database

```bash
# Nuke and rebuild remote DB (no data preserved)
cd server
go run cmd/reset_schema.go
```

---

## React Query Hooks

All data fetching uses React Query hooks in `/frontend/src/hooks/queries/`:

### User Hooks (`useUserProfile.ts`)
- `useUserProfile()` - Fetch username, email, phone, avatar
- `useUpdateProfile()` - Update user profile
- `useUpdateAvatar()` - Update avatar URL

### Group Hooks (`useGroups.ts`)
- `useUserGroups()` - Fetch user's groups
- `useGroupChannels(groupId)` - Fetch channels in a group
- `useCreateGroup()` - Create new group
- `useJoinGroup()` - Join existing group
- `useCreateChannel()` - Create new channel

### Message Hooks (`useMessages.ts`)
- `useChannelMessages(channelId)` - Fetch messages for channel
- `useConversationMessages(conversationId)` - Fetch DM messages
- `useSendMessage()` - Send new message
- `useCreateOrGetDMConversation()` - Start DM with user

---

## Current Status

### Completed

- React Query integration for all remote data
- Network-first data fetching
- Automatic cache invalidation
- Username/avatar update flow (network-first)
- Type safety documentation
- Migration system working

### 🚧 In Progress

- Apply avatar_url migration to remote DB (restart server)
- Clean up local DB schema (remove unnecessary tables)
- Generate TypeScript types from Go models (optional)

### 📋 Future Work

- Offline resilience (queue operations, sync on reconnect)
- Optimistic updates for messages
- Background sync
- IndexedDB cache for web version
- React Query DevTools integration

---

## Development Workflow

### Starting the App

```bash
# Start server (runs migrations automatically)
pnpm dev

# Or just Wails app (includes server)
pnpm dev:wails
```

### Making Schema Changes

1. Create migration file in appropriate directory
2. Restart server to apply
3. Update Go models if needed
4. Update TypeScript types to match
5. Update React Query hooks if needed

### Testing

```bash
# Run server tests
cd server
go test ./...

# Run frontend tests (if any)
cd frontend
pnpm test
```

---

## Security Model

### Threat Model

**Trusted**:
- User's device
- User's local database (encrypted at rest)
- Desktop app code

**Untrusted**:
- Network
- Remote server
- Server operators
- Other users (except for identity verification)

### Security Guarantees

1. **End-to-End Encryption**: Only sender and recipients can read messages
2. **Forward Secrecy**: Compromised long-term keys don't decrypt old messages
3. **Post-Compromise Security**: Compromised session keys eventually heal
4. **Deniable Authentication**: Can't prove who sent a message
5. **Zero-Knowledge Server**: Server can't read message content

### What Server Can See

- User exists (ID, username, email, phone, avatar)
- Group membership
- Message metadata (sender, recipient, timestamp, size)
- Connection patterns (who talks to whom, when)
- Message content (encrypted)
- Private keys (never leave device)

---

## Summary

Pollis is architected as:
- **Frontend**: React + TypeScript + React Query + Zustand
- **Desktop**: Wails (Go backend embedded in desktop app)
- **Server**: gRPC server with Turso (libSQL) database
- **Encryption**: Signal Protocol (X3DH + Double Ratchet)
- **Storage**: Remote for metadata, local for secrets

This gives you **Signal's security** (e2e encryption, zero-knowledge server) with **Slack's features** (groups, channels, rich UX).
