-- Initial database schema for Pollis
-- All IDs use ULID format (TEXT)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    identity_key_public BLOB NOT NULL,
    identity_key_private BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Group Members Table
CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_identifier TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, user_identifier)
);

-- Channels Table
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    channel_type TEXT NOT NULL DEFAULT 'text',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Direct Message Conversations Table
CREATE TABLE IF NOT EXISTS dm_conversations (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_identifier TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_identifier)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT,
    conversation_id TEXT,
    author_id TEXT NOT NULL,
    content_encrypted BLOB NOT NULL,
    reply_to_message_id TEXT,
    thread_id TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id),
    FOREIGN KEY (thread_id) REFERENCES messages(id),
    CHECK ((channel_id IS NULL) != (conversation_id IS NULL))
);

-- Message Attachments Table (Future)
CREATE TABLE IF NOT EXISTS message_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_data_encrypted BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Message Reactions Table (Future)
CREATE TABLE IF NOT EXISTS message_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id, emoji)
);

-- Pinned Messages Table
CREATE TABLE IF NOT EXISTS pinned_messages (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    pinned_by TEXT NOT NULL,
    pinned_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (pinned_by) REFERENCES users(id),
    UNIQUE(message_id)
);

-- Message Queue Table (Offline Messages)
CREATE TABLE IF NOT EXISTS message_queue (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Signal Sessions Table
CREATE TABLE IF NOT EXISTS signal_sessions (
    id TEXT PRIMARY KEY,
    local_user_id TEXT NOT NULL,
    remote_user_identifier TEXT NOT NULL,
    session_data BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (local_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(local_user_id, remote_user_identifier)
);

-- Group Keys Table
CREATE TABLE IF NOT EXISTS group_keys (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    channel_id TEXT,
    key_data BLOB NOT NULL,
    key_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_channels_group_id ON channels(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);

