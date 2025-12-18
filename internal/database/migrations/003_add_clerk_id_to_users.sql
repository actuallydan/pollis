-- Add clerk_id to users table to link users to Clerk authentication
-- SQLite doesn't support adding UNIQUE constraint directly on ALTER TABLE ADD COLUMN
-- So we add the column first, then create a unique index
-- This migration is idempotent - if column exists, it will be skipped by migration handler

-- Step 1: Add column (without UNIQUE - SQLite limitation)
-- If column already exists, this will fail with "duplicate column" error
-- The migration handler will catch this and skip the migration
ALTER TABLE users ADD COLUMN clerk_id TEXT;

-- Step 2: Create unique index (enforces uniqueness)
-- This is idempotent - IF NOT EXISTS handles it
DROP INDEX IF EXISTS idx_users_clerk_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id) WHERE clerk_id IS NOT NULL;

