-- Add clerk_id to users table to link users to Clerk authentication
-- This allows users to recover their account if they lose their device
-- Migration 003: Add clerk_id column (nullable)

-- Add clerk_id column (nullable)
-- Note: If this fails with "duplicate column name", the column already exists
-- and this migration may have run before. The migration system should prevent
-- running it twice, but if it does run twice, the error is expected.
ALTER TABLE users ADD COLUMN clerk_id TEXT;

-- Create unique index (allows NULLs, but unique for non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id_unique ON users(clerk_id) WHERE clerk_id IS NOT NULL;

-- Create index for faster lookups by clerk_id
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Note: Making clerk_id NOT NULL requires a separate migration after existing users are migrated
-- This is handled in migration 006_make_clerk_id_required.sql

