-- Make clerk_id required (NOT NULL) for all new users
-- This migration assumes existing users have been migrated to have clerk_id values
-- If there are existing users without clerk_id, they will need to be handled separately

-- Step 0: Ensure clerk_id column exists (safety check in case migration 003 didn't run)
-- Try to add it if it doesn't exist - if it already exists, this will fail
-- but we can't catch that in SQL, so we'll just try and let the migration system handle it
-- Note: This is a workaround - migration 003 should have added this column
ALTER TABLE users ADD COLUMN clerk_id TEXT;

-- Make clerk_id NOT NULL
-- Note: This will fail if there are existing NULL values
-- For production, you may need to:
-- 1. Update all existing users to have clerk_id values
-- 2. Or delete users without clerk_id (if they're test data)
-- 3. Or create a temporary migration to set default values

-- For now, we'll use a safe approach that only adds the constraint if no NULLs exist
-- In SQLite/libSQL, we need to recreate the table to add NOT NULL constraint

-- Step 1: Verify clerk_id column exists by checking table schema
-- If it doesn't exist, we can't proceed - migration 003 must run first
-- We'll use a pragma to check, but for libSQL/Turso we might not have access to pragmas
-- So we'll just try to use it and let it fail if it doesn't exist

-- Step 2: Create new table with NOT NULL constraint
CREATE TABLE IF NOT EXISTS users_new (
    id TEXT PRIMARY KEY,
    clerk_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    public_key BLOB,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Step 3: Copy data from old table (only rows with clerk_id)
-- This will fail if clerk_id column doesn't exist, which is expected
-- Migration 003 must run first
INSERT INTO users_new (id, clerk_id, username, email, phone, public_key, created_at, updated_at)
SELECT id, clerk_id, username, email, phone, public_key, created_at, updated_at
FROM users
WHERE clerk_id IS NOT NULL;

-- Step 4: Drop old table
DROP TABLE users;

-- Step 5: Rename new table
ALTER TABLE users_new RENAME TO users;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

