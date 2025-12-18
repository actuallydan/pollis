-- Add slug field to channels and create compound unique index
-- Migration 002: Add channel slug

-- Note: older SQLite doesn't support ALTER TABLE ... IF NOT EXISTS.
-- To make this safe and idempotent, we rebuild the table with the slug column.

PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Recreate channels table with slug column
CREATE TABLE channels_new (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    channel_type TEXT NOT NULL DEFAULT 'text',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    slug TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Migrate data; generate slug from channel name + first 8 chars of ID for uniqueness
-- This ensures no collisions even if multiple channels have the same name
INSERT INTO channels_new (id, group_id, name, description, channel_type, created_by, created_at, updated_at, slug)
SELECT 
    id, 
    group_id, 
    name, 
    description, 
    channel_type, 
    created_by, 
    created_at, 
    updated_at,
    lower(replace(replace(replace(replace(replace(name, ' ', '-'), '_', '-'), '.', '-'), '/', '-'), '\\', '-')) || '-' || substr(id, 1, 8)
FROM channels;

-- Replace old table
DROP TABLE channels;
ALTER TABLE channels_new RENAME TO channels;

-- Recreate indexes (drop was implicit with table drop)
CREATE INDEX IF NOT EXISTS idx_channels_group_id ON channels(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_group_slug ON channels(group_id, slug);

-- Add index on groups.slug for faster lookups (it's already UNIQUE but explicit index helps)
CREATE INDEX IF NOT EXISTS idx_groups_slug_lookup ON groups(slug);

-- Add index on groups.name for case-insensitive search
CREATE INDEX IF NOT EXISTS idx_groups_name_nocase ON groups(name COLLATE NOCASE);

COMMIT;
PRAGMA foreign_keys=on;

