package models

// User represents a user in the service (minimal metadata only)
// Per AUTH_AND_DB_MIGRATION.md: username, email, phone, avatar_url removed
type User struct {
	ID        string `json:"id"`       // ULID
	ClerkID   string `json:"clerk_id"` // Required, links to Clerk account
	CreatedAt int64  `json:"created_at"`
	Disabled  int    `json:"disabled"` // 0 = enabled, 1 = disabled
}

// Group represents a group/organization
type Group struct {
	ID          string `json:"id"` // ULID
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	CreatedBy   string `json:"created_by"` // user_id
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

// GroupMember represents a member of a group
type GroupMember struct {
	ID             string `json:"id"` // ULID
	GroupID        string `json:"group_id"`
	UserIdentifier string `json:"user_identifier"` // username/email/phone
	JoinedAt       int64  `json:"joined_at"`
}

// Channel represents a channel within a group
type Channel struct {
	ID          string `json:"id"` // ULID
	GroupID     string `json:"group_id"`
	Slug        string `json:"slug"` // Unique within group
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	ChannelType string `json:"channel_type"` // 'text' or 'voice'
	CreatedBy   string `json:"created_by"`   // user_id
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

// KeyExchangeMessage represents a key exchange message
type KeyExchangeMessage struct {
	ID               string `json:"id"` // ULID
	FromUserID       string `json:"from_user_id"`
	ToUserIdentifier string `json:"to_user_identifier"`
	MessageType      string `json:"message_type"` // 'prekey_bundle', 'key_exchange', etc.
	EncryptedData    []byte `json:"-"`            // Encrypted Signal protocol data
	CreatedAt        int64  `json:"created_at"`
	ExpiresAt        *int64 `json:"expires_at,omitempty"`
}

// WebRTCSignal represents a WebRTC signaling message
type WebRTCSignal struct {
	ID         string `json:"id"` // ULID
	FromUserID string `json:"from_user_id"`
	ToUserID   string `json:"to_user_id"`
	SignalType string `json:"signal_type"` // 'offer', 'answer', 'ice_candidate'
	SignalData string `json:"signal_data"` // JSON string
	CreatedAt  int64  `json:"created_at"`
	ExpiresAt  *int64 `json:"expires_at,omitempty"`
}

// PreKeyBundle represents a user's pre-key bundle (identity + signed pre-key)
type PreKeyBundle struct {
	UserID          string `json:"user_id"`
	IdentityKey     []byte `json:"identity_key"`
	SignedPreKey    []byte `json:"signed_pre_key"`
	SignedPreKeySig []byte `json:"signed_pre_key_sig"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
}

// OneTimePreKey represents an OTPK for X3DH
type OneTimePreKey struct {
	ID         string `json:"id"` // ULID
	UserID     string `json:"user_id"`
	PreKey     []byte `json:"pre_key"`
	Consumed   bool   `json:"consumed"`
	CreatedAt  int64  `json:"created_at"`
	ConsumedAt *int64 `json:"consumed_at,omitempty"`
}

// SenderKey represents a group/channel sender key
type SenderKey struct {
	ID         string `json:"id"` // ULID
	GroupID    string `json:"group_id"`
	ChannelID  string `json:"channel_id"`
	SenderKey  []byte `json:"sender_key"`
	KeyVersion int    `json:"key_version"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

// SenderKeyRecipient tracks recipients for a sender key
type SenderKeyRecipient struct {
	ID                  string `json:"id"` // ULID
	SenderKeyID         string `json:"sender_key_id"`
	RecipientIdentifier string `json:"recipient_identifier"`
	CreatedAt           int64  `json:"created_at"`
}

// KeyBackup represents an encrypted key backup for recovery
type KeyBackup struct {
	UserID       string `json:"user_id"`
	EncryptedKey []byte `json:"-"` // Encrypted key material (encrypted with Clerk token)
	UpdatedAt    int64  `json:"updated_at"`
}
