-- Key backups table for recovery
CREATE TABLE IF NOT EXISTS key_backups (
    user_id TEXT PRIMARY KEY,
    encrypted_key BLOB NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_key_backups_updated ON key_backups(updated_at);

