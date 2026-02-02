package models

// ============================================================================
// Authentication & Device Management
// ============================================================================

// AuthSession represents a Clerk authentication session stored locally
type AuthSession struct {
	ID               string `json:"id"`                 // local UUID
	ClerkUserID      string `json:"clerk_user_id"`
	ClerkSessionToken string `json:"-"`                 // Sensitive, not exposed
	AppAuthToken     string `json:"-"`                  // Sensitive, not exposed
	CreatedAt        int64  `json:"created_at"`
	ExpiresAt        int64  `json:"expires_at"`
	LastUsedAt       int64  `json:"last_used_at"`
}

// Device represents a registered device for a user
type Device struct {
	ID              string `json:"id"`                // device UUID
	ClerkUserID     string `json:"clerk_user_id"`
	DeviceName      string `json:"device_name,omitempty"`
	DevicePublicKey []byte `json:"-"`                 // Device identity key
	CreatedAt       int64  `json:"created_at"`
}

// User represents a user in the system
// Identity keys are now stored in separate IdentityKey table
// Username, email, and phone are stored in the service DB, not locally
type User struct {
	ID        string `json:"id"`        // ULID
	ClerkID   string `json:"clerk_id"`  // Clerk user ID (required, NOT NULL)
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// ============================================================================
// Cryptographic Keys (Local Storage - Encrypted at Rest)
// ============================================================================

// IdentityKey represents the long-term identity key pair
type IdentityKey struct {
	ID                 int    `json:"id"`
	PublicKey          []byte `json:"public_key"`
	PrivateKeyEncrypted []byte `json:"-"`  // Encrypted with local master key
	CreatedAt          int64  `json:"created_at"`
}

// SignedPreKey represents a signed prekey for X3DH
type SignedPreKey struct {
	ID                 int    `json:"id"`
	PublicKey          []byte `json:"public_key"`
	PrivateKeyEncrypted []byte `json:"-"`  // Encrypted with local master key
	Signature          []byte `json:"signature"`
	CreatedAt          int64  `json:"created_at"`
	ExpiresAt          int64  `json:"expires_at,omitempty"`
}

// OneTimePreKey represents a one-time prekey for X3DH
type OneTimePreKey struct {
	ID                 int    `json:"id"`
	PublicKey          []byte `json:"public_key"`
	PrivateKeyEncrypted []byte `json:"-"`  // Encrypted with local master key
	Consumed           bool   `json:"consumed"`
	CreatedAt          int64  `json:"created_at"`
}

// ============================================================================
// Double Ratchet State
// ============================================================================

// Session represents a Double Ratchet session with a peer
type Session struct {
	ID                        string `json:"id"`  // peer or device ID
	PeerUserID                string `json:"peer_user_id"`
	RootKeyEncrypted          []byte `json:"-"`
	SendingChainKeyEncrypted  []byte `json:"-"`
	ReceivingChainKeyEncrypted []byte `json:"-"`
	SendCount                 int    `json:"send_count"`
	RecvCount                 int    `json:"recv_count"`
	LastUsedAt                int64  `json:"last_used_at"`
}

// Group represents a group/organization
type Group struct {
	ID          string `json:"id"` // ULID
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	IconURL     string `json:"icon_url,omitempty"`
	CreatedBy   string `json:"created_by"` // user_id
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

// GroupMembership represents a member of a group (local storage)
type GroupMembership struct {
	GroupID  string `json:"group_id"`
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
	JoinedAt int64  `json:"joined_at"`
}

// GroupMember represents a member of a group (for backward compatibility)
type GroupMember struct {
	ID             string `json:"id"` // ULID
	GroupID        string `json:"group_id"`
	UserIdentifier string `json:"user_identifier"` // username/email/phone
	JoinedAt       int64  `json:"joined_at"`
}

// GroupSenderKey represents the sender key for group encryption
type GroupSenderKey struct {
	GroupID           string `json:"group_id"`
	SenderKeyEncrypted []byte `json:"-"`
	DistributionState []byte `json:"-"`  // Who has received it
	CreatedAt         int64  `json:"created_at"`
}

// Alias represents a per-group display name
type Alias struct {
	ID          string `json:"id"`
	GroupID     string `json:"group_id"`
	DisplayName string `json:"display_name"`
	AvatarHash  string `json:"avatar_hash,omitempty"`
	CreatedAt   int64  `json:"created_at"`
}

// Channel represents a channel within a group
type Channel struct {
	ID          string `json:"id"` // ULID
	GroupID     string `json:"group_id"`
	Slug        string `json:"slug"`        // Unique within group
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	ChannelType string `json:"channel_type"` // 'text' or 'voice'
	CreatedBy   string `json:"created_by"`   // user_id
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

// DMConversation represents a direct message conversation
type DMConversation struct {
	ID              string `json:"id"` // ULID
	User1ID         string `json:"user1_id"`
	User2Identifier string `json:"user2_identifier"` // username/email/phone
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
}

// Message represents a message in a channel or DM
type Message struct {
	ID               string `json:"id"` // ULID
	ConversationID   string `json:"conversation_id"`  // user or group ID
	SenderID         string `json:"sender_id"`
	Ciphertext       []byte `json:"-"`                // Encrypted, not exposed to frontend
	Nonce            []byte `json:"-"`                // Nonce for encryption
	CreatedAt        int64  `json:"created_at"`
	Delivered        bool   `json:"delivered"`
	// Additional fields for backward compatibility
	ChannelID        string `json:"channel_id,omitempty"`
	Content          string `json:"content,omitempty"` // Decrypted content (only when loaded)
	ReplyToMessageID string `json:"reply_to_message_id,omitempty"`
	ThreadID         string `json:"thread_id,omitempty"`
	IsPinned         bool   `json:"is_pinned"`
}

// Attachment represents a file attachment to a message
type Attachment struct {
	ID         string `json:"id"`
	MessageID  string `json:"message_id"`
	Ciphertext []byte `json:"-"`  // Encrypted file data
	MimeType   string `json:"mime_type"`
	Size       int64  `json:"size"`
}

// MessageAttachment represents a file attachment (future)
type MessageAttachment struct {
	ID                string `json:"id"` // ULID
	MessageID         string `json:"message_id"`
	FileName          string `json:"file_name"`
	FileType          string `json:"file_type"`
	FileSize          int64  `json:"file_size"`
	FileDataEncrypted []byte `json:"-"` // Encrypted, not exposed
	CreatedAt         int64  `json:"created_at"`
}

// MessageReaction represents a reaction to a message (future)
type MessageReaction struct {
	ID        string `json:"id"` // ULID
	MessageID string `json:"message_id"`
	UserID    string `json:"user_id"`
	Emoji     string `json:"emoji"`
	CreatedAt int64  `json:"created_at"`
}

// PinnedMessage represents a pinned message
type PinnedMessage struct {
	ID        string `json:"id"` // ULID
	MessageID string `json:"message_id"`
	PinnedBy  string `json:"pinned_by"` // user_id
	PinnedAt  int64  `json:"pinned_at"`
}

// MessageQueue represents a queued message (offline)
type MessageQueue struct {
	ID         string `json:"id"` // ULID
	MessageID  string `json:"message_id"`
	Status     string `json:"status"` // 'pending', 'sending', 'sent', 'failed', 'cancelled'
	RetryCount int    `json:"retry_count"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

// SignalSession represents a Signal protocol session (for backward compatibility)
type SignalSession struct {
	ID                   string `json:"id"` // ULID
	LocalUserID          string `json:"local_user_id"`
	RemoteUserIdentifier string `json:"remote_user_identifier"`
	SessionData          []byte `json:"-"` // Encrypted session state
	CreatedAt            int64  `json:"created_at"`
	UpdatedAt            int64  `json:"updated_at"`
}

// GroupKey represents encryption keys for groups/channels (for backward compatibility)
type GroupKey struct {
	ID         string `json:"id"` // ULID
	GroupID    string `json:"group_id"`
	ChannelID  string `json:"channel_id,omitempty"`
	KeyData    []byte `json:"-"` // Encrypted key material
	KeyVersion int    `json:"key_version"`
	CreatedAt  int64  `json:"created_at"`
}

// ============================================================================
// Voice/Video (RTC)
// ============================================================================

// RTCSession represents a WebRTC session with encrypted SRTP keys
type RTCSession struct {
	ID              string `json:"id"`
	PeerID          string `json:"peer_id"`
	SRTPKeyEncrypted []byte `json:"-"`  // DTLS-SRTP derived key
	CreatedAt       int64  `json:"created_at"`
	EndedAt         int64  `json:"ended_at,omitempty"`
}

// ============================================================================
// Miscellaneous
// ============================================================================

// KeyValue represents a generic key-value store for feature flags, migrations, etc.
type KeyValue struct {
	Key   string `json:"key"`
	Value []byte `json:"-"`  // Can store any data
}
