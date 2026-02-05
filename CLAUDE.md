# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pollis is a privacy-first desktop messaging app with end-to-end encryption using Signal Protocol. Built with Wails (Go + React), it combines Signal's security with Slack's group messaging features. The server never sees message plaintext.

**Stack**: Wails v2, React/TypeScript, Go, gRPC, Turso (libSQL), Signal Protocol

**Key Architecture**: Desktop app connects **directly** to Turso (1 hop). Server exists ONLY for WebRTC signaling, message relay, and key exchange coordination. All CRUD operations (users, groups, channels) go through Wails backend → Turso, NOT through the gRPC server.

## Development Commands

### Setup
```bash
pnpm install              # Install dependencies
pnpm proto                # Generate protobuf code (required after proto changes)
cp .env.example .env.local # Set up environment (add Turso credentials)
```

### Running
```bash
pnpm dev                  # Run server + desktop app
pnpm dev:wails            # Run desktop app only (includes embedded server)
pnpm dev:frontend         # Run frontend in browser
pnpm dev:server           # Run gRPC server only
```

### Building
```bash
pnpm build:app            # Build Wails app for current platform
make build-macos          # Build universal macOS binary (Intel + Apple Silicon)
make build-linux          # Build Linux amd64 binary
make build-windows        # Build Windows amd64 binary
```

### Protobuf
```bash
pnpm proto                # Generate Go/TypeScript code from proto files
make proto                # Alternative using Makefile
```

### Server Commands
```bash
cd server
go run cmd/server/main.go              # Run server directly
go run cmd/reset_schema.go             # Reset remote database (destructive)
go test ./...                          # Run Go tests
```

## Architecture

### 🎯 CRITICAL: Network Architecture

**Desktop App → Turso (DIRECT libSQL connection)**
- ✅ **1 network hop** - simple and fast
- Desktop app is compiled Go - same capabilities as server!
- Uses libSQL driver directly to connect to Turso

**Server ONLY exists for:**
- 🔄 **WebRTC signaling** (needs central coordination)
- 📨 **Message relay** (for offline delivery)
- 🔑 **Key exchange coordination** (when users establish sessions)

**Desktop app handles DIRECTLY (no server middleman):**
- ✅ User profile CRUD (username, avatar, etc.)
- ✅ Groups and channels CRUD
- ✅ Reading/writing to Turso
- ✅ R2 uploads/downloads (avatar images, file attachments)

**DO NOT add gRPC endpoints for CRUD operations** - the desktop app should connect to Turso directly using the libSQL client.

### Data Storage Model

**Remote Database (Turso)** - Stores public metadata:
- Users (id, clerk_id, username, email, phone, avatar_url)
- Groups, channels, membership
- Public keys for Signal Protocol key exchange
- Encrypted message envelopes (for offline delivery)
- **Never stores**: message plaintext, private keys

**Local Database (SQLite)** - Stores secrets:
- Encrypted messages (ciphertext, nonce)
- Private keys (encrypted at rest)
- Signal protocol session state
- **Never stores**: user profiles, groups, channels (fetched from remote)

### Frontend Data Fetching

All non-encrypted data uses **React Query** with network-first strategy:

```typescript
// React Query hooks in frontend/src/hooks/queries/
useUserProfile()                    // User profile (username, email, avatar)
useUserGroups()                     // Groups user belongs to
useGroupChannels(groupId)           // Channels in a group
useChannelMessages(channelId)       // Messages (encrypted, from local DB)
useCreateGroup()                    // Create group mutation
useSendMessage()                    // Send message mutation
```

**React Query calls Wails backend → Wails backend calls Turso directly** (no gRPC server for CRUD).

**Benefits**: Automatic caching, deduplication, refetching, optimistic updates, cache invalidation.

**Zustand store**: Only holds UI state (selected group/channel), current user reference, temporary session data.

### Message Encryption Flow

**Sending**:
1. User types message → Frontend encrypts with Signal protocol
2. Store encrypted locally in SQLite
3. Send ciphertext to **server** via gRPC (server needed for message relay)
4. Server stores in message_envelope for delivery
5. Recipients fetch envelope, decrypt locally

**Key Exchange (X3DH)**:
- Alice requests Bob's prekey bundle via **server** (coordination needed)
- Derives shared secret using X3DH
- Creates session, encrypts first message
- Both establish session for ongoing communication

### Project Structure

```
frontend/           # React app (Vite, TypeScript, TailwindCSS)
  src/
    hooks/queries/  # React Query hooks (useUserProfile, useGroups, useMessages)
    types/          # TypeScript types (documented with storage location)
    components/     # React components
    services/       # API client
server/             # gRPC server
  cmd/              # Server executables (main.go, reset_schema.go, etc.)
  internal/         # Server logic (handlers, database, migrations)
internal/           # Desktop app Go code (Wails backend)
  services/         # Business logic services
  database/         # Local SQLite database
  signal/           # Signal protocol implementation
pkg/proto/          # Shared protobuf definitions
packages/monopollis # Shared React UI library for frontend and website
website             # Next.js app on Vercel for auth and marketing info
```

### Database Migrations

**Remote migrations** (server/internal/database/migrations/):
- Run automatically on server startup
- Tracked in `schema_migrations` table
- Create new migration: `NNN_description.sql` (increment number)

**Local migrations** (internal/database/migrations/):
- Applied to desktop app's local SQLite database
- Stores encrypted messages and crypto state

**Resetting remote DB**: `cd server && go run cmd/reset_schema.go` (destructive)

## Type Safety

TypeScript types in `frontend/src/types/index.ts` are documented with:
- Storage location (Remote DB vs Local DB)
- React Query hook for fetching
- Security notes (encrypted, never persisted, etc.)

Example:
```typescript
export interface Message {
  // Stored in: Local DB (encrypted)
  // Fetched via: useChannelMessages()
  // CRITICAL: Encrypted content NEVER leaves device in plaintext
  id: string;
  ciphertext: Uint8Array;  // Signal protocol encrypted
  content_decrypted?: string;  // In-memory only, never persisted
}
```

## Security Model

**Trusted**: User's device, local database (encrypted at rest), desktop app code

**Untrusted**: Network, remote server, server operators

**Server can see**: User metadata, group membership, message metadata (sender, timestamp, size), connection patterns

**Server cannot see**: Message content (encrypted), private keys (never leave device)

## Key Files

- `app.go` - Wails app entry point, service initialization
- `frontend/src/main.tsx` - React app entry point
- `frontend/src/services/api.ts` - API client for backend calls
- `server/cmd/server/main.go` - gRPC server entry point
- `pkg/proto/pollis.proto` - gRPC service definitions
- `ARCHITECTURE.md` - Detailed architecture documentation (read this first for deep dives)

## Important Notes

- **Desktop app connects DIRECTLY to Turso** - Do NOT route CRUD operations through the gRPC server
- **Server is ONLY for signaling/relay** - WebRTC signaling, message relay, key exchange coordination
- **Always regenerate protobuf code** after modifying `.proto` files: `pnpm proto`
- **Prefer editing existing files** over creating new ones
- **React Query is the source of truth** for remote data - don't duplicate in Zustand
- **Local DB should NOT have users/groups/channels tables** - those come from remote Turso
- **TypeScript types should match Go models** - keep them synchronized
- **Migrations run automatically** on server startup - create new files, don't modify existing ones


## Other tidbits
- When responding be as succint as possible unless I ask for full explanation
- When coding if statements, NEVER use inline statements e.g.
```
// BAD
if (!currentUser) return;

// GOOD
if (!currentUser) {
  return;
}
```
- Avoid inline comments, place them above their relevant line
```
checkStatus(); // Verify with backend
```
- Always use `pnpm` and not `npm` when possible