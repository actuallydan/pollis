-- Pre-key bundles and sender key distribution

-- Pre-key bundle (one per user)
CREATE TABLE IF NOT EXISTS prekey_bundles (
    user_id TEXT PRIMARY KEY,
    identity_key BLOB NOT NULL,         -- Ed25519 public key
    signed_pre_key BLOB NOT NULL,       -- X25519 public key
    signed_pre_key_sig BLOB NOT NULL,   -- Ed25519 signature over signed_pre_key
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One-time pre-keys
CREATE TABLE IF NOT EXISTS one_time_prekeys (
    id TEXT PRIMARY KEY,                -- ULID
    user_id TEXT NOT NULL,
    pre_key BLOB NOT NULL,              -- X25519 public key
    consumed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    consumed_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_otpk_user_consumed ON one_time_prekeys(user_id, consumed, created_at);

-- Rate limiting for pre-key bundle requests (per user per day)
CREATE TABLE IF NOT EXISTS prekey_bundle_requests (
    user_id TEXT NOT NULL,
    day INTEGER NOT NULL,               -- YYYYMMDD as integer
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sender keys (per group/channel)
CREATE TABLE IF NOT EXISTS sender_keys (
    id TEXT PRIMARY KEY,                -- ULID
    group_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    sender_key BLOB NOT NULL,           -- AES-256 key material
    key_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(group_id, channel_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

-- Sender key recipients (tracking who should receive current key)
CREATE TABLE IF NOT EXISTS sender_key_recipients (
    id TEXT PRIMARY KEY,                -- ULID
    sender_key_id TEXT NOT NULL,
    recipient_identifier TEXT NOT NULL, -- username/email/phone
    created_at INTEGER NOT NULL,
    FOREIGN KEY (sender_key_id) REFERENCES sender_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sender_key_recipients_sender_key ON sender_key_recipients(sender_key_id);

