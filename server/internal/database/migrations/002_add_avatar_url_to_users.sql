-- Add avatar_url column to users table
-- This stores the user's profile avatar (R2 object key)
-- Per-group avatars are stored in the alias table

ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Add index for avatar_url lookups (optional, but useful)
CREATE INDEX idx_users_avatar_url ON users(avatar_url) WHERE avatar_url IS NOT NULL;
