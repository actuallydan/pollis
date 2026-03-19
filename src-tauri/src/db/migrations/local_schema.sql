CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_key (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    public_key BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signed_prekey (
    id INTEGER PRIMARY KEY,
    public_key BLOB NOT NULL,
    signature BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS one_time_prekey (
    id INTEGER PRIMARY KEY,
    public_key BLOB NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signal_session (
    user_id TEXT NOT NULL,
    device_id INTEGER NOT NULL DEFAULT 1,
    session_data BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS group_sender_key (
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    chain_id BLOB NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    chain_key BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, sender_id)
);

CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    ciphertext BLOB NOT NULL,
    content TEXT,
    reply_to_id TEXT,
    sent_at TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    delivered INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_message_conversation ON message(conversation_id, sent_at);

CREATE TABLE IF NOT EXISTS attachment (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES message(id),
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    encryption_key BLOB NOT NULL,
    downloaded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dm_conversation (
    id TEXT PRIMARY KEY,
    peer_user_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User preferences (offline mirror of remote user_preferences)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id     TEXT PRIMARY KEY,
    preferences TEXT NOT NULL DEFAULT '{}',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

