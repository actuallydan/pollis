# Pollis - E2E Encrypted Messaging App Specification

## Overview

Pollis is an end-to-end encrypted desktop messaging application built with Wails (Go + React/TypeScript), designed to function like Slack but with full Signal protocol encryption. The MVP focuses on secure group messaging with channels, without real-time WebSocket connections initially.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop App (Wails)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   React UI   │  │  Go Backend  │  │  libSQL DB   │     │
│  │  (Slack-like)│◄─┤  (App Logic) │◄─┤  (Local)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                                 │
│         └──────────────────┼─────────────────────────────────┘
│                            │ Wails IPC Bridge
│                            │ (No local server)
│                            ▼
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Signal Protocol (Go Library)                 │  │
│  │  - Double Ratchet                                   │  │
│  │  - Forward Secrecy                                  │  │
│  │  - Key Exchange                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ gRPC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Go Service (Hostinger/Fly.io)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  gRPC API    │  │   User Mgmt  │  │  Signaling   │     │
│  │              │  │   & Groups   │  │  (WebRTC)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   libSQL/Turso  │                        │
│                   │   (Metadata)    │                        │
│                   └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Identity & Authentication

- **Clerk Authentication**: Users authenticate with Clerk (passwordless, magic link, OAuth, passkeys)
- **Session Persistence**: Users stay logged in across app restarts (Clerk token stored securely)
- **User Identity**:
  - **User ID**: ULID (canonical identity, stored in service DB)
  - **Clerk ID**: Links User to Clerk account (required, stored in both local and service DB)
  - **UserSnapshot**: Local encrypted SQLite DB containing offline copy of user's data (messages, channels, groups)
- **User Discovery**: Service lookup by `clerk_id` to find existing User ID
- **User Data**: Username, email, phone stored in service DB only (not on client)
- **Identity Keys**: Each user generates a Signal identity key pair locally (stored encrypted in UserSnapshot)
- **No Profile Selection**: Users authenticate once, stay logged in until explicit logout

### 2. Groups & Channels

- **Groups**: Top-level organizations (e.g., "my-test-org")
  - Have a unique slug (e.g., "my-test-org")
  - Contain multiple channels
  - Have a list of member user identifiers
- **Channels**: Sub-spaces within groups
  - Belong to a single group
  - Contain messages
  - Have a type: 'text' or 'voice' (voice not implemented in MVP)
  - All members of the group can access all channels
- **Messages**: Individual encrypted messages within channels or direct messages
  - Encrypted using Signal protocol
  - Stored locally only
  - Include metadata: timestamp, author, channel/conversation ID
  - Support replies to other messages (with preview snippet)
  - Support threads (non-nested)
  - Can be pinned (persisted across installs)
- **Direct Messages**: One-on-one encrypted conversations between users
  - Same encryption model as channel messages
  - Stored in separate conversation space

### 3. Invitations & Discovery

- **Invitation Flow**:
  1. User A invites User B to a group by email/phone/username
  2. Service adds User B's identifier to the group's member list
  3. User B receives no notification (yet)
  4. User B can search for the group by slug
  5. If User B is on the member list, the group appears in search
  6. When User B joins, the app:
     - Downloads group metadata
     - Updates local keys (Signal protocol session establishment)
     - Syncs encrypted messages (if any)

### 4. Encryption Model

- **Signal Protocol**: Full implementation with double ratchet
- **Forward Secrecy**: Each message uses a new key
- **Group Encryption**:
  - Each channel maintains Signal sessions with all members
  - Messages encrypted separately for each member (or use group key derivation)
- **Direct Message Encryption**:
  - One-on-one Signal sessions between users
  - Same encryption guarantees as group messages
- **Key Storage**: All keys stored encrypted in local libSQL database
- **Message Storage**: All messages stored encrypted in local libSQL database

### 5. Offline-First Architecture

- **Offline-First**: App works fully offline
  - Users can read all locally stored messages
  - Users can compose and queue messages while offline
  - Messages are sent when network connectivity is restored
- **Message Queue**:
  - Pending messages stored in local queue
  - Automatically sent when online
  - Users can cancel queued messages before sending
- **Network Status**:
  - Clear visual indicator showing online/offline status
  - Network kill-switch to force offline mode (for testing/privacy)
- **Sync**:
  - Poll service for updates when online
  - Sync messages, key exchanges, and metadata

## Data Models

### Desktop App (libSQL)

#### Users Table

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- ULID
    clerk_id TEXT UNIQUE NOT NULL,          -- Clerk user ID (required)
    identity_key_public BLOB NOT NULL,      -- Encrypted
    identity_key_private BLOB NOT NULL,     -- Encrypted
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

**Note**: Username, email, and phone are NOT stored in the local database. They are stored in the service DB and fetched when needed.

#### Groups Table

```sql
CREATE TABLE groups (
    id TEXT PRIMARY KEY,                    -- ULID
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,               -- user_id
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### Group Members Table

```sql
CREATE TABLE group_members (
    id TEXT PRIMARY KEY,                    -- ULID
    group_id TEXT NOT NULL,
    user_identifier TEXT NOT NULL,          -- username/email/phone
    joined_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, user_identifier)
);
```

#### Channels Table

```sql
CREATE TABLE channels (
    id TEXT PRIMARY KEY,                    -- ULID
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    channel_type TEXT NOT NULL DEFAULT 'text',  -- 'text' or 'voice'
    created_by TEXT NOT NULL,               -- user_id
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### Messages Table

```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,                    -- ULID
    channel_id TEXT,                        -- NULL for direct messages
    conversation_id TEXT,                   -- NULL for channel messages, ULID for DMs
    author_id TEXT NOT NULL,                -- user_id
    content_encrypted BLOB NOT NULL,        -- Encrypted message content
    reply_to_message_id TEXT,               -- ULID of message being replied to
    thread_id TEXT,                         -- ULID of thread root (NULL if not in thread)
    is_pinned INTEGER NOT NULL DEFAULT 0,  -- 0 or 1, persisted across installs
    timestamp INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id),
    FOREIGN KEY (thread_id) REFERENCES messages(id),
    CHECK ((channel_id IS NULL) != (conversation_id IS NULL))  -- Exactly one must be set
);
```

#### Direct Message Conversations Table

```sql
CREATE TABLE dm_conversations (
    id TEXT PRIMARY KEY,                    -- ULID (conversation_id)
    user1_id TEXT NOT NULL,                 -- user_id
    user2_identifier TEXT NOT NULL,        -- username/email/phone of other user
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_identifier)
);
```

#### Message Attachments Table (Future)

```sql
CREATE TABLE message_attachments (
    id TEXT PRIMARY KEY,                    -- ULID
    message_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_data_encrypted BLOB NOT NULL,     -- Encrypted file content
    created_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

#### Message Reactions Table (Future)

```sql
CREATE TABLE message_reactions (
    id TEXT PRIMARY KEY,                    -- ULID
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,                    -- Unicode emoji or custom emoji ID
    created_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id, emoji)
);
```

#### Pinned Messages Table

```sql
CREATE TABLE pinned_messages (
    id TEXT PRIMARY KEY,                    -- ULID
    message_id TEXT NOT NULL,
    pinned_by TEXT NOT NULL,               -- user_id
    pinned_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (pinned_by) REFERENCES users(id),
    UNIQUE(message_id)
);
```

#### Message Queue Table (Offline Messages)

```sql
CREATE TABLE message_queue (
    id TEXT PRIMARY KEY,                    -- ULID
    message_id TEXT NOT NULL,               -- Reference to messages table
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed', 'cancelled'
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

#### Signal Sessions Table

```sql
CREATE TABLE signal_sessions (
    id TEXT PRIMARY KEY,                    -- ULID
    local_user_id TEXT NOT NULL,
    remote_user_identifier TEXT NOT NULL,   -- username/email/phone
    session_data BLOB NOT NULL,             -- Encrypted Signal session state
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (local_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(local_user_id, remote_user_identifier)
);
```

#### Group Keys Table

```sql
CREATE TABLE group_keys (
    id TEXT PRIMARY KEY,                    -- ULID
    group_id TEXT NOT NULL,
    channel_id TEXT,                        -- NULL for group-level keys
    key_data BLOB NOT NULL,                 -- Encrypted key material
    key_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);
```

### Service (libSQL/Turso)

#### Users Table (Metadata Only)

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- ULID (from client)
    clerk_id TEXT UNIQUE NOT NULL,          -- Clerk user ID (required, for account recovery)
    username TEXT,                          -- Optional, for display
    email TEXT,                             -- Optional, for invitations
    phone TEXT,                             -- Optional, for invitations
    public_key BLOB,                        -- Public identity key (for key exchange)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

#### Groups Table

```sql
CREATE TABLE groups (
    id TEXT PRIMARY KEY,                    -- ULID
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,               -- user_id
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

#### Group Members Table

```sql
CREATE TABLE group_members (
    id TEXT PRIMARY KEY,                    -- ULID
    group_id TEXT NOT NULL,
    user_identifier TEXT NOT NULL,          -- username/email/phone
    joined_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, user_identifier)
);
```

#### Channels Table

```sql
CREATE TABLE channels (
    id TEXT PRIMARY KEY,                    -- ULID
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    channel_type TEXT NOT NULL DEFAULT 'text',  -- 'text' or 'voice'
    created_by TEXT NOT NULL,               -- user_id
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
```

#### Key Exchange Messages Table

```sql
CREATE TABLE key_exchange_messages (
    id TEXT PRIMARY KEY,                    -- ULID
    from_user_id TEXT NOT NULL,
    to_user_identifier TEXT NOT NULL,
    message_type TEXT NOT NULL,             -- 'prekey_bundle', 'key_exchange', etc.
    encrypted_data BLOB NOT NULL,           -- Encrypted Signal protocol data
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY (from_user_id) REFERENCES users(id)
);
```

#### WebRTC Signaling Table

```sql
CREATE TABLE webrtc_signaling (
    id TEXT PRIMARY KEY,                    -- ULID
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    signal_type TEXT NOT NULL,              -- 'offer', 'answer', 'ice_candidate'
    signal_data TEXT NOT NULL,              -- JSON string (libSQL doesn't have JSONB)
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
);
```

## API Specification (gRPC)

### Service Definition

```protobuf
syntax = "proto3";

package pollis;

service PollisService {
  // User Management
  rpc RegisterUser(RegisterUserRequest) returns (RegisterUserResponse);
  rpc GetUserByClerkID(GetUserByClerkIDRequest) returns (GetUserByClerkIDResponse);
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc SearchUsers(SearchUsersRequest) returns (SearchUsersResponse);

  // Group Management
  rpc CreateGroup(CreateGroupRequest) returns (CreateGroupResponse);
  rpc GetGroup(GetGroupRequest) returns (GetGroupResponse);
  rpc SearchGroup(SearchGroupRequest) returns (SearchGroupResponse);
  rpc InviteToGroup(InviteToGroupRequest) returns (InviteToGroupResponse);
  rpc ListUserGroups(ListUserGroupsRequest) returns (ListUserGroupsResponse);

  // Channel Management
  rpc CreateChannel(CreateChannelRequest) returns (CreateChannelResponse);
  rpc ListChannels(ListChannelsRequest) returns (ListChannelsResponse);

  // Key Exchange
  rpc SendKeyExchange(SendKeyExchangeRequest) returns (SendKeyExchangeResponse);
  rpc GetKeyExchangeMessages(GetKeyExchangeMessagesRequest) returns (GetKeyExchangeMessagesResponse);
  rpc MarkKeyExchangeRead(MarkKeyExchangeReadRequest) returns (MarkKeyExchangeReadResponse);

  // WebRTC Signaling (for future voice channels)
  rpc SendWebRTCSignal(SendWebRTCSignalRequest) returns (SendWebRTCSignalResponse);
  rpc GetWebRTCSignals(GetWebRTCSignalsRequest) returns (GetWebRTCSignalsResponse);
}

// User Messages
message RegisterUserRequest {
  string user_id = 1;
  string clerk_id = 2;                     -- Required, links to Clerk account
  optional string username = 3;
  optional string email = 4;
  optional string phone = 5;
  bytes public_key = 6;
}

message GetUserByClerkIDRequest {
  string clerk_id = 1;
}

message GetUserByClerkIDResponse {
  string user_id = 1;
  optional string username = 2;
  optional string email = 3;
  optional string phone = 4;
  bytes public_key = 5;
}

message RegisterUserResponse {
  bool success = 1;
  string message = 2;
}

message GetUserRequest {
  string user_identifier = 1;  // username, email, or phone
}

message GetUserResponse {
  string user_id = 1;
  string username = 2;
  optional string email = 3;
  optional string phone = 4;
  bytes public_key = 5;
}

message SearchUsersRequest {
  string query = 1;
  int32 limit = 2;
}

message SearchUsersResponse {
  repeated GetUserResponse users = 1;
}

// Group Messages
message CreateGroupRequest {
  string group_id = 1;
  string slug = 2;
  string name = 3;
  optional string description = 4;
  string created_by = 5;
}

message CreateGroupResponse {
  bool success = 1;
  string group_id = 2;
  string message = 3;
}

message GetGroupRequest {
  string group_id = 1;
}

message GetGroupResponse {
  string group_id = 1;
  string slug = 2;
  string name = 3;
  optional string description = 4;
  string created_by = 5;
  repeated string member_identifiers = 6;
}

message SearchGroupRequest {
  string slug = 1;
  string user_identifier = 2;  // Only returns group if user is a member
}

message SearchGroupResponse {
  optional GetGroupResponse group = 1;
  bool is_member = 2;
}

message InviteToGroupRequest {
  string group_id = 1;
  string user_identifier = 2;  // username, email, or phone
  string invited_by = 3;
}

message InviteToGroupResponse {
  bool success = 1;
  string message = 2;
}

message ListUserGroupsRequest {
  string user_identifier = 1;
}

message ListUserGroupsResponse {
  repeated GetGroupResponse groups = 1;
}

// Channel Messages
message CreateChannelRequest {
  string channel_id = 1;
  string group_id = 2;
  string name = 3;
  optional string description = 4;
  string created_by = 5;
}

message CreateChannelResponse {
  bool success = 1;
  string channel_id = 2;
  string message = 3;
}

message ListChannelsRequest {
  string group_id = 1;
}

message ListChannelsResponse {
  repeated ChannelInfo channels = 1;
}

message ChannelInfo {
  string channel_id = 1;
  string name = 2;
  optional string description = 3;
  string created_by = 4;
}

// Key Exchange Messages
message SendKeyExchangeRequest {
  string from_user_id = 1;
  string to_user_identifier = 2;
  string message_type = 3;  // 'prekey_bundle', 'key_exchange', etc.
  bytes encrypted_data = 4;
  int64 expires_in_seconds = 5;
}

message SendKeyExchangeResponse {
  bool success = 1;
  string message_id = 2;
  string message = 3;
}

message GetKeyExchangeMessagesRequest {
  string user_identifier = 1;
}

message GetKeyExchangeMessagesResponse {
  repeated KeyExchangeMessage messages = 1;
}

message KeyExchangeMessage {
  string message_id = 1;
  string from_user_id = 2;
  string message_type = 3;
  bytes encrypted_data = 4;
  int64 created_at = 5;
}

message MarkKeyExchangeReadRequest {
  repeated string message_ids = 1;
}

message MarkKeyExchangeReadResponse {
  bool success = 1;
}

// WebRTC Signaling Messages
message SendWebRTCSignalRequest {
  string from_user_id = 1;
  string to_user_id = 2;
  string signal_type = 3;  // 'offer', 'answer', 'ice_candidate'
  string signal_data = 4;  // JSON string
  int64 expires_in_seconds = 5;
}

message SendWebRTCSignalResponse {
  bool success = 1;
  string signal_id = 2;
}

message GetWebRTCSignalsRequest {
  string user_id = 1;
}

message GetWebRTCSignalsResponse {
  repeated WebRTCSignal signals = 1;
}

message WebRTCSignal {
  string signal_id = 1;
  string from_user_id = 2;
  string signal_type = 3;
  string signal_data = 4;
  int64 created_at = 5;
}
```

## Desktop App Architecture

### Go Backend (`app.go`)

#### Core Services

1. **Database Service**

   - Initialize libSQL database
   - Handle migrations
   - Provide CRUD operations for all tables
   - Encryption/decryption of sensitive data

2. **Signal Protocol Service**

   - Wrap Signal protocol library
   - Manage identity keys
   - Handle key exchange
   - Encrypt/decrypt messages
   - Manage sessions (double ratchet)

3. **Group Service**

   - Create/manage groups
   - Handle invitations
   - Search groups
   - Sync with service

4. **Channel Service**

   - Create/manage channels
   - List channels in groups

5. **Message Service**

   - Send messages (encrypt, store locally)
   - Receive messages (decrypt, store locally)
   - List messages in channels

6. **Service Client**
   - gRPC client for service communication
   - Handle authentication (if needed)
   - Poll for updates (no WebSockets yet)
   - Queue management for offline messages
   - Network status monitoring
   - Kill-switch support (force offline mode)

### React Frontend

#### Component Structure

```
src/
├── App.tsx                    # Main app component
├── components/
│   ├── Layout/
│   │   ├── Sidebar.tsx        # Slack-like sidebar (groups/channels)
│   │   ├── ChannelList.tsx    # List of channels in selected group
│   │   └── MainContent.tsx    # Message area
│   ├── Groups/
│   │   ├── GroupList.tsx      # List of groups
│   │   ├── GroupItem.tsx      # Individual group item
│   │   ├── CreateGroupModal.tsx
│   │   └── InviteUserModal.tsx
│   ├── Channels/
│   │   ├── ChannelHeader.tsx  # Channel name, description
│   │   ├── MessageList.tsx    # Scrollable message list
│   │   ├── MessageItem.tsx    # Individual message
│   │   ├── MessageInput.tsx   # Input area (use ChatInput component)
│   │   └── CreateChannelModal.tsx
│   ├── Auth/
│   │   └── ClerkAuth.tsx      # Clerk authentication (web only)
│   └── Search/
│       └── SearchGroupModal.tsx
├── hooks/
│   ├── useGroups.ts
│   ├── useChannels.ts
│   ├── useMessages.ts
│   ├── useDirectMessages.ts
│   ├── useSignal.ts
│   ├── useService.ts
│   ├── useNetworkStatus.ts
│   └── useVirtualizedList.ts
├── stores/
│   └── appStore.ts            # State management (Zustand/Context)
└── utils/
    ├── encryption.ts          # Encryption helpers
    └── api.ts                 # gRPC client helpers
```

#### UI Design (Slack-like)

- **Left Sidebar**: Groups list (collapsible)
  - Each group shows channels
  - Direct messages section (DMs)
  - Active group/channel/conversation highlighted
- **Main Area**:
  - Top: Channel/conversation header (name, description, member count)
  - Top-right: Network status indicator (online/offline/kill-switch)
  - Middle: Virtualized message list (scrollable, newest at bottom)
    - Message replies show preview snippet (clickable to scroll to original)
    - Pinned messages indicator
    - Thread indicators (future)
  - Bottom: Message input (use existing `ChatInput` component)
    - Reply preview when replying to message
- **Right Sidebar** (optional, future): User list, channel info, pinned messages
- **Color Scheme**: Use existing orange-300/black theme
- **Typography**: Use existing Header, Paragraph components
- **Components**: Reuse all components from `components/` folder extensively
  - Use `ChatInput` for message input
  - Use `Card`, `Button`, `Badge`, etc. for UI elements
  - Use `LoadingSpinner` for async operations
  - Use `Table` for lists if appropriate
  - Maximize component reuse for future npm package

### Key Flows

#### 1. App Startup / Authentication

```
User opens app
  → Check for stored Clerk session (keychain/secure storage)
  → If session exists:
     - Verify token with Clerk (quick validation)
     - If valid: Load UserSnapshot, show main app (no auth UI)
     - If invalid: Clear session, show auth screen
  → If no session: Show Clerk auth screen
  → After Clerk auth:
     - Store Clerk token securely (keychain/secure storage)
     - Query service: GetUserByClerkID(clerk_id)
     - If User exists: Use existing User ID (ULID)
     - If User doesn't exist:
        * Generate ULID for User
        * Create User in local UserSnapshot (ULID + clerk_id)
        * Register User with service (ULID + clerk_id + public key)
     - Load UserSnapshot: profiles/{user_id}/pollis.db
     - Show main app
```

#### 2. Create Group

```
User clicks "Create Group"
  → Show CreateGroupModal
  → User enters name, slug, description
  → Create group in local DB
  → Create group on service (gRPC CreateGroup)
  → Add creator as member
  → Update UI
```

#### 3. Invite User to Group

```
User clicks "Invite" on group
  → Show InviteUserModal
  → User enters email/phone/username
  → Call service (gRPC InviteToGroup)
  → Service adds user identifier to group members
  → (No notification sent yet)
```

#### 4. Search and Join Group

```
User searches for group by slug
  → Call service (gRPC SearchGroup) with user identifier
  → Service checks if user is member
  → If member, return group data
  → App downloads group metadata
  → Establish Signal sessions with all members
  → Sync channels
  → Update local DB
  → Show group in UI
```

#### 5. Send Message (Channel or DM)

```
User types message in channel/DM
  → User clicks send
  → If replying, store reply_to_message_id
  → Get Signal session for recipients (group members or DM recipient)
  → Encrypt message for each recipient (or use group key)
  → Store encrypted message locally
  → Add to message queue (if offline or kill-switch active)
  → If online: Send to service for delivery
  → Update UI with message (pending/sent status)
```

#### 5b. Offline Message Queue

```
Message queued (offline/kill-switch)
  → Store in message_queue table with status 'pending'
  → Show in UI with pending indicator
  → User can cancel queued message (delete from queue and messages)
  → When network restored:
    → Process queue in order
    → Update status to 'sending', then 'sent' or 'failed'
    → Retry failed messages (with backoff)
```

#### 5c. Reply to Message

```
User clicks reply on message
  → Show reply preview above input (use existing components)
  → Store reply_to_message_id when sending
  → On message display, show reply preview snippet
  → Clicking preview scrolls to original message (virtualized list)
```

#### 5d. Pin Message

```
User pins message
  → Set is_pinned flag on message
  → Add to pinned_messages table
  → Show pin indicator in message
  → Pinned messages persist across app reinstalls
  → (Future: Show in right sidebar or dedicated view)
```

#### 6. Receive Message (Future)

```
Poll service for new messages (when online)
  → Get encrypted messages for user
  → Decrypt using Signal protocol
  → Store in local DB
  → Update UI (virtualized list)
```

#### 7. Direct Message Flow

```
User starts DM conversation
  → Search for user by identifier
  → Create or get dm_conversation record
  → Establish Signal session if needed
  → Send/receive messages (same as channel messages)
  → Show in DM section of sidebar
```

#### 8. Network Kill-Switch

```
User activates kill-switch
  → Force app into offline mode
  → Stop all network requests
  → Show kill-switch indicator in UI
  → Queue all outgoing messages
  → User can deactivate to resume normal operation
```

## Service Architecture

### Go Service Structure

```
cmd/
└── server/
    └── main.go              # Entry point, gRPC server setup

internal/
├── database/
│   └── libsql.go             # libSQL/Turso connection, migrations
├── handlers/
│   └── pollis_handler.go     # gRPC handler implementations
├── models/
│   └── models.go            # Data models
├── services/
│   ├── user_service.go
│   ├── group_service.go
│   ├── channel_service.go
│   ├── key_exchange_service.go
│   └── webrtc_service.go
└── utils/
    └── validation.go

pkg/
└── proto/
    └── pollis.proto           # Protocol buffer definitions
    └── pollis.pb.go           # Generated code
```

### Service Responsibilities

1. **User Management**

   - Store user metadata (username, email, phone, public key)
   - Search users by identifier
   - No authentication/authorization (trust-based for MVP)

2. **Group Management**

   - Store group metadata
   - Manage group members
   - Handle invitations (add to member list)
   - Search groups (only return if user is member)

3. **Key Exchange**

   - Store encrypted key exchange messages
   - Deliver to recipients
   - Expire old messages

4. **WebRTC Signaling** (Future)
   - Store signaling messages (offers, answers, ICE candidates)
   - Deliver to recipients
   - Expire old messages

### Deployment

- **Container**: Docker
- **Hosting**: Hostinger or Fly.io
- **Database**: libSQL/Turso (cloud-hosted libSQL)
- **Protocol**: gRPC (with gRPC-Web for browser if needed)

## Security Considerations

### Encryption

1. **At Rest**:

   - All sensitive data in local DB encrypted
   - Use AES-256-GCM with key derived from user password/master key
   - Keys stored in OS keychain/credential store

2. **In Transit**:

   - All gRPC communication over TLS
   - Service doesn't see plaintext messages (only encrypted blobs)

3. **Signal Protocol**:
   - Forward secrecy via double ratchet
   - Perfect forward secrecy (PFS)
   - Message authentication

### Key Management

1. **Identity Keys**: Generated once, stored encrypted locally
2. **Session Keys**: Managed by Signal protocol, stored encrypted
3. **Group Keys**: (Optional) Derived keys for group encryption efficiency
4. **Master Key**: User password-derived key for local encryption

### Threat Model (MVP)

- **Server Compromise**: Server only sees encrypted blobs, metadata
- **Local Device Compromise**: Requires master key/password
- **Network Interception**: TLS protects in-transit data
- **Message Replay**: Timestamps and nonces prevent replay

## Development Phases

### Phase 1: Foundation

- [ ] Set up libSQL database in desktop app
- [ ] Implement database migrations
- [ ] Create data models (Go structs)
- [ ] Set up encryption utilities
- [ ] Integrate Signal protocol library
- [ ] Basic identity creation flow

### Phase 2: Service Setup

- [ ] Create Go service project structure
- [ ] Set up PostgreSQL database
- [ ] Define gRPC proto files
- [ ] Generate gRPC code
- [ ] Implement basic gRPC handlers
- [ ] Deploy service to Hostinger/Fly.io

### Phase 3: Groups & Channels

- [ ] Implement group creation (desktop + service)
- [ ] Implement channel creation
- [ ] Build group/channel UI components
- [ ] Implement invitation flow
- [ ] Implement group search and join

### Phase 4: Messaging

- [ ] Implement message encryption/decryption
- [ ] Implement message storage (local)
- [ ] Build message UI components
- [ ] Implement message sending flow
- [ ] (Future) Implement message polling/receiving

### Phase 5: Polish

- [ ] Error handling and validation
- [ ] Loading states and UI feedback
- [ ] Offline support (queue messages)
- [ ] Testing and bug fixes

### Phase 6: Future Enhancements

- [ ] WebSocket real-time updates
- [ ] WebRTC voice channels
- [ ] File attachments
- [ ] Message reactions
- [ ] User presence
- [ ] Notifications

## Technical Stack

### Desktop App

- **Framework**: Wails v2
- **Backend**: Go 1.23+
- **Frontend**: React 18, TypeScript
- **Package Manager**: pnpm (for future monorepo)
- **UI**: Tailwind CSS, existing component library (maximize reuse)
- **Database**: libSQL (SQLite-compatible, local)
- **Encryption**: Signal protocol (Go library)
- **API Client**: gRPC-Go
- **Communication**: Wails IPC Bridge (no local HTTP server)
- **Lists**: Virtualized lists for performance (react-window or similar)

### Service

- **Language**: Go 1.23+
- **Framework**: gRPC
- **Database**: libSQL/Turso (cloud-hosted)
- **Deployment**: Docker
- **Hosting**: Hostinger or Fly.io

## File Structure

### Desktop App

```
pollis/
├── app.go                    # Main app struct, Wails bindings
├── main.go                   # Entry point
├── internal/
│   ├── database/
│   │   ├── db.go            # libSQL connection, migrations
│   │   └── migrations/      # SQL migration files
│   ├── encryption/
│   │   └── crypto.go        # Encryption utilities
│   ├── signal/
│   │   └── signal.go        # Signal protocol wrapper
│   ├── services/
│   │   ├── user_service.go
│   │   ├── group_service.go
│   │   ├── channel_service.go
│   │   ├── message_service.go
│   │   ├── dm_service.go
│   │   ├── queue_service.go
│   │   ├── network_service.go
│   │   └── service_client.go  # gRPC client
│   └── models/
│       └── models.go        # Data models
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── components/      # (existing + new)
│       ├── hooks/          # (existing + new)
│       ├── stores/         # State management
│       └── utils/          # Utilities
└── pkg/
    └── proto/              # Shared proto files
```

### Service

```
pollis-service/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── database/
│   ├── handlers/
│   ├── services/
│   └── models/
├── pkg/
│   └── proto/
└── Dockerfile
```

## Notes

- **No Real-time Yet**: Messages are polled, not pushed (WebSocket support later)
- **Offline-First**: App fully functional offline, queues messages for later
- **Wails IPC**: All frontend-backend communication via Wails IPC bridge (no local server)
- **Local Storage Primary**: Messages stored locally, service only for coordination
- **ULIDs**: All IDs use ULID format (not UUIDs) for better sortability
- **Component Reuse**: Maximize use of existing components for future npm package
- **Virtualized Lists**: All message lists use virtualization for performance
- **Simple MVP**: Focus on core functionality, not enterprise features
- **Security First**: All encryption handled properly, even in MVP
- **Slack-like UI**: Familiar interface, but fully encrypted
- **Future Features**: Schema accounts for threads, reactions, file attachments (not implemented yet)

## Implementation Details

### Wails IPC Bridge Usage

All frontend-to-backend communication uses Wails IPC bridge:

- Methods exposed via `app.go` struct
- Frontend calls via generated `wailsjs/go/main/App` functions
- No local HTTP server needed
- Prevents network leakage within app

### Virtualized Lists

- Use `react-window` or `react-virtualized` for message lists
- Only render visible messages for performance
- Smooth scrolling with large message histories
- Support scroll-to-message for reply navigation

### Offline Queue Management

- Messages in queue have status: `pending`, `sending`, `sent`, `failed`, `cancelled`
- User can cancel pending messages before network restore
- Automatic retry with exponential backoff for failed messages
- Queue processed in order when network restored

### Network Status

- Monitor network connectivity
- Show clear indicator (online/offline/kill-switch)
- Kill-switch forces offline mode (for testing/privacy)
- All network operations respect kill-switch state

### Direct Messages

- Separate conversation space from channels
- Same encryption model as group messages
- One-on-one Signal sessions
- Shown in dedicated DM section of sidebar

### Message Replies

- Reply preview shows snippet of original message
- Clicking preview scrolls to original (virtualized list)
- Reply relationship stored in `reply_to_message_id`
- UI shows reply thread visually

### Pinned Messages

- `is_pinned` flag on messages
- Separate `pinned_messages` table for persistence
- Pinned messages survive app reinstalls
- (Future: Dedicated pinned messages view)

## Open Questions / Future Decisions

1. **Group Key Strategy**: Encrypt per-member or use group key derivation?
2. **Message Delivery**: Polling frequency and retry strategy
3. **Conflict Resolution**: How to handle concurrent edits/conflicts?
4. **Key Rotation**: How often to rotate group keys?
5. **Message Retention**: How long to keep messages locally?
6. **Backup/Sync**: Should users be able to backup/restore their local DB?
7. **Thread UI**: How to display threads in virtualized list?
8. **Voice Channels**: Implementation details when ready
