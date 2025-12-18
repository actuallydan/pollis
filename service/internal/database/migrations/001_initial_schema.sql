-- Initial database schema for Pollis Service
-- All IDs use ULID format (TEXT)
-- This schema stores only metadata, not encrypted message content

-- Users Table (Metadata Only)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                    -- ULID (from client)
    username TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    public_key BLOB,                        -- Public identity key (for key exchange)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,                    -- ULID
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,               -- user_id
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Group Members Table
CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,                    -- ULID
    group_id TEXT NOT NULL,
    user_identifier TEXT NOT NULL,          -- username/email/phone
    joined_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, user_identifier)
);

-- Channels Table
CREATE TABLE IF NOT EXISTS channels (
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

-- Key Exchange Messages Table
CREATE TABLE IF NOT EXISTS key_exchange_messages (
    id TEXT PRIMARY KEY,                    -- ULID
    from_user_id TEXT NOT NULL,
    to_user_identifier TEXT NOT NULL,
    message_type TEXT NOT NULL,             -- 'prekey_bundle', 'key_exchange', etc.
    encrypted_data BLOB NOT NULL,           -- Encrypted Signal protocol data
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY (from_user_id) REFERENCES users(id)
);

-- WebRTC Signaling Table
CREATE TABLE IF NOT EXISTS webrtc_signaling (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_groups_slug ON groups(slug);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_identifier ON group_members(user_identifier);
CREATE INDEX IF NOT EXISTS idx_channels_group_id ON channels(group_id);
CREATE INDEX IF NOT EXISTS idx_key_exchange_to_user ON key_exchange_messages(to_user_identifier);
CREATE INDEX IF NOT EXISTS idx_key_exchange_expires ON key_exchange_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_webrtc_to_user ON webrtc_signaling(to_user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_expires ON webrtc_signaling(expires_at);

