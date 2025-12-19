-- Initial comprehensive schema for remote (Turso) database
-- Based on AUTH_AND_DB_MIGRATION.md
-- Minimal schema - only stores what's needed for coordination

-- ============================================================================
-- Users (Minimal Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_user_clerk_id ON user(clerk_id);
CREATE INDEX idx_user_disabled ON user(disabled) WHERE disabled = 1;

-- ============================================================================
-- Multi-Device Support
-- ============================================================================

CREATE TABLE IF NOT EXISTS device (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key BLOB,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_user_id ON device(user_id);

-- ============================================================================
-- Public Key Distribution (X3DH)
-- ============================================================================

-- Identity keys (public only)
CREATE TABLE IF NOT EXISTS identity_key (
  user_id TEXT PRIMARY KEY,
  public_key BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Signed prekeys
CREATE TABLE IF NOT EXISTS signed_prekey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  signature BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_signed_prekey_user_id ON signed_prekey(user_id);
CREATE INDEX idx_signed_prekey_expires_at ON signed_prekey(expires_at);

-- One-time prekeys
CREATE TABLE IF NOT EXISTS one_time_prekey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_one_time_prekey_user_id ON one_time_prekey(user_id);
CREATE INDEX idx_one_time_prekey_consumed ON one_time_prekey(consumed);

-- ============================================================================
-- Groups & Channels
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_table (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES user(id)
);

CREATE INDEX idx_group_table_slug ON group_table(slug);
CREATE INDEX idx_group_table_created_by ON group_table(created_by);

-- Group membership
CREATE TABLE IF NOT EXISTS group_member (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES group_table(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_group_member_user_id ON group_member(user_id);

-- Per-group display names (aliases)
CREATE TABLE IF NOT EXISTS alias (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES group_table(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_alias_group_id ON alias(group_id);
CREATE INDEX idx_alias_user_id ON alias(user_id);

CREATE TABLE IF NOT EXISTS channel (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'text',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES group_table(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES user(id),
  UNIQUE(group_id, slug)
);

CREATE INDEX idx_channel_group_id ON channel(group_id);

-- ============================================================================
-- Message Relay (Optional - for offline delivery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_envelope (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT,
  channel_id TEXT,
  ciphertext BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sender_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channel(id) ON DELETE CASCADE
);

CREATE INDEX idx_message_envelope_sender_id ON message_envelope(sender_id);
CREATE INDEX idx_message_envelope_recipient_id ON message_envelope(recipient_id);
CREATE INDEX idx_message_envelope_channel_id ON message_envelope(channel_id);
CREATE INDEX idx_message_envelope_delivered ON message_envelope(delivered);
CREATE INDEX idx_message_envelope_created_at ON message_envelope(created_at);

-- ============================================================================
-- WebRTC Signaling
-- ============================================================================

CREATE TABLE IF NOT EXISTS rtc_room (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (channel_id) REFERENCES channel(id) ON DELETE CASCADE
);

CREATE INDEX idx_rtc_room_channel_id ON rtc_room(channel_id);

CREATE TABLE IF NOT EXISTS rtc_participant (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rtc_room(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_rtc_participant_user_id ON rtc_participant(user_id);

-- ============================================================================
-- Key Exchange & WebRTC Signaling Messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS key_exchange_messages (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_identifier TEXT NOT NULL,
  message_type TEXT NOT NULL,
  encrypted_data BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (from_user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_key_exchange_messages_to_user ON key_exchange_messages(to_user_identifier);
CREATE INDEX idx_key_exchange_messages_from_user ON key_exchange_messages(from_user_id);
CREATE INDEX idx_key_exchange_messages_created_at ON key_exchange_messages(created_at);

CREATE TABLE IF NOT EXISTS webrtc_signaling (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (from_user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_webrtc_signaling_to_user ON webrtc_signaling(to_user_id);
CREATE INDEX idx_webrtc_signaling_from_user ON webrtc_signaling(from_user_id);
CREATE INDEX idx_webrtc_signaling_created_at ON webrtc_signaling(created_at);

-- ============================================================================
-- Sender Keys (Group Encryption)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sender_keys (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sender_key BLOB NOT NULL,
  key_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES group_table(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channel(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_sender_keys_group_id ON sender_keys(group_id);
CREATE INDEX idx_sender_keys_channel_id ON sender_keys(channel_id);
CREATE INDEX idx_sender_keys_user_id ON sender_keys(user_id);

CREATE TABLE IF NOT EXISTS sender_key_recipients (
  id TEXT PRIMARY KEY,
  sender_key_id TEXT NOT NULL,
  recipient_identifier TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sender_key_id) REFERENCES sender_keys(id) ON DELETE CASCADE
);

CREATE INDEX idx_sender_key_recipients_sender_key_id ON sender_key_recipients(sender_key_id);
