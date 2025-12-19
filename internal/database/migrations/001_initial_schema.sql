-- Initial comprehensive schema for local database
-- Based on AUTH_AND_DB_MIGRATION.md
-- All private keys stored encrypted at rest

-- ============================================================================
-- Core User Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);

-- ============================================================================
-- Authentication Sessions (Local Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  clerk_session_token TEXT NOT NULL,
  app_auth_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE INDEX idx_auth_session_clerk_user_id ON auth_session(clerk_user_id);
CREATE INDEX idx_auth_session_expires_at ON auth_session(expires_at);

-- ============================================================================
-- Multi-Device Support
-- ============================================================================

CREATE TABLE IF NOT EXISTS device (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_public_key BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_device_clerk_user_id ON device(clerk_user_id);

-- ============================================================================
-- Signal Protocol Keys (Encrypted at Rest)
-- ============================================================================

-- Long-term identity keypair (encrypted private key)
CREATE TABLE IF NOT EXISTS identity_key (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_key BLOB NOT NULL,
  private_key_encrypted BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

-- Signed prekeys (rotated every 30 days)
CREATE TABLE IF NOT EXISTS signed_prekey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_key BLOB NOT NULL,
  private_key_encrypted BLOB NOT NULL,
  signature BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_signed_prekey_expires_at ON signed_prekey(expires_at);

-- One-time prekeys (single use)
CREATE TABLE IF NOT EXISTS one_time_prekey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_key BLOB NOT NULL,
  private_key_encrypted BLOB NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_one_time_prekey_consumed ON one_time_prekey(consumed);

-- ============================================================================
-- Double Ratchet Session State (Encrypted)
-- ============================================================================

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  peer_user_id TEXT NOT NULL,
  root_key_encrypted BLOB NOT NULL,
  sending_chain_key_encrypted BLOB NOT NULL,
  receiving_chain_key_encrypted BLOB NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 0,
  receive_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_session_peer_user_id ON session(peer_user_id);

-- ============================================================================
-- Groups & Channels
-- ============================================================================

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_groups_created_by ON groups(created_by);

-- Group membership with roles
CREATE TABLE IF NOT EXISTS group_membership (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_membership_group_id ON group_membership(group_id);
CREATE INDEX idx_group_membership_user_id ON group_membership(user_id);

-- Sender keys for group encryption
CREATE TABLE IF NOT EXISTS group_sender_key (
  group_id TEXT NOT NULL,
  sender_key_encrypted BLOB NOT NULL,
  distribution_state BLOB,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id)
);

-- Per-group display names (aliases)
CREATE TABLE IF NOT EXISTS alias (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_alias_group_id ON alias(group_id);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'text',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(group_id, slug)
);

CREATE INDEX idx_channels_group_id ON channels(group_id);
CREATE INDEX idx_channels_slug ON channels(group_id, slug);

-- ============================================================================
-- Messages (New Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  -- Backward compatibility fields
  channel_id TEXT,
  reply_to_message_id TEXT,
  thread_id TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (channel_id IS NOT NULL AND conversation_id IS NOT NULL) OR
    (channel_id IS NULL AND conversation_id IS NOT NULL)
  )
);

CREATE INDEX idx_message_conversation_id ON message(conversation_id);
CREATE INDEX idx_message_sender_id ON message(sender_id);
CREATE INDEX idx_message_created_at ON message(created_at);
CREATE INDEX idx_message_channel_id ON message(channel_id);
CREATE INDEX idx_message_delivered ON message(delivered);
CREATE INDEX idx_message_is_pinned ON message(is_pinned) WHERE is_pinned = 1;

-- ============================================================================
-- Attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS attachment (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachment_message_id ON attachment(message_id);

-- ============================================================================
-- Direct Messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS dm_conversations (
  id TEXT PRIMARY KEY,
  user1_id TEXT NOT NULL,
  user2_identifier TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_dm_conversations_user1_id ON dm_conversations(user1_id);
CREATE INDEX idx_dm_conversations_user2_identifier ON dm_conversations(user2_identifier);

-- ============================================================================
-- WebRTC (Voice/Video)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rtc_session (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  srtp_key_encrypted BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX idx_rtc_session_channel_id ON rtc_session(channel_id);

-- ============================================================================
-- Queue & Sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  queued_at INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at INTEGER,
  FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE
);

CREATE INDEX idx_message_queue_queued_at ON message_queue(queued_at);
CREATE INDEX idx_message_queue_message_id ON message_queue(message_id);

-- ============================================================================
-- Pinned Messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS pinned_messages (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  pinned_by TEXT NOT NULL,
  pinned_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE,
  UNIQUE(message_id)
);

CREATE INDEX idx_pinned_messages_message_id ON pinned_messages(message_id);

-- ============================================================================
-- Key-Value Store (Feature Flags, Preferences, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS key_value (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
