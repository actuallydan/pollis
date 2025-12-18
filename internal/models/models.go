package models

// User represents a user in the system
// Username, email, and phone are stored in the service DB, not locally
type User struct {
	ID                 string `json:"id"`        // ULID
	ClerkID            string `json:"clerk_id"`  // Clerk user ID (required, NOT NULL)
	IdentityKeyPublic  []byte `json:"-"`        // Encrypted, not exposed to frontend
	IdentityKeyPrivate []byte `json:"-"`        // Encrypted, not exposed to frontend
	CreatedAt          int64  `json:"created_at"`
	UpdatedAt          int64  `json:"updated_at"`
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
	ChannelID        string `json:"channel_id,omitempty"`
	ConversationID   string `json:"conversation_id,omitempty"`
	AuthorID         string `json:"author_id"`
	ContentEncrypted []byte `json:"-"`                 // Encrypted, not exposed to frontend
	Content          string `json:"content,omitempty"` // Decrypted content (only when loaded)
	ReplyToMessageID string `json:"reply_to_message_id,omitempty"`
	ThreadID         string `json:"thread_id,omitempty"`
	IsPinned         bool   `json:"is_pinned"`
	Timestamp        int64  `json:"timestamp"`
	CreatedAt        int64  `json:"created_at"`
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

// SignalSession represents a Signal protocol session
type SignalSession struct {
	ID                   string `json:"id"` // ULID
	LocalUserID          string `json:"local_user_id"`
	RemoteUserIdentifier string `json:"remote_user_identifier"`
	SessionData          []byte `json:"-"` // Encrypted session state
	CreatedAt            int64  `json:"created_at"`
	UpdatedAt            int64  `json:"updated_at"`
}

// GroupKey represents encryption keys for groups/channels
type GroupKey struct {
	ID         string `json:"id"` // ULID
	GroupID    string `json:"group_id"`
	ChannelID  string `json:"channel_id,omitempty"`
	KeyData    []byte `json:"-"` // Encrypted key material
	KeyVersion int    `json:"key_version"`
	CreatedAt  int64  `json:"created_at"`
}
