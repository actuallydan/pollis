-- Add avatar_url column to users table
-- Migration 007: Add avatar_url column for user avatars (R2 object key or public URL)
-- Note: If this fails with "duplicate column name", the column already exists
-- and this migration may have run before. The migration system should prevent
-- running it twice, but if it does run twice, the error is expected.

-- Check if column exists first (SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN)
-- We'll use a try-catch approach by attempting to add it
-- If it fails, we'll ignore the error (column already exists)
ALTER TABLE users ADD COLUMN avatar_url TEXT;

