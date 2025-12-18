package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// MessageService handles message-related operations
type MessageService struct {
	db *sql.DB
}

// NewMessageService creates a new message service
func NewMessageService(db *sql.DB) *MessageService {
	return &MessageService{db: db}
}

// CreateMessage creates a new message
func (s *MessageService) CreateMessage(message *models.Message) error {
	if message.ID == "" {
		message.ID = utils.NewULID()
	}

	if message.Timestamp == 0 {
		message.Timestamp = utils.GetCurrentTimestamp()
	}

	message.CreatedAt = utils.GetCurrentTimestamp()

	query := `
		INSERT INTO messages (id, channel_id, conversation_id, author_id, content_encrypted, 
		                     reply_to_message_id, thread_id, is_pinned, timestamp, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	isPinned := 0
	if message.IsPinned {
		isPinned = 1
	}

	// Convert empty strings to NULL for nullable fields to satisfy CHECK constraint
	var channelID, conversationID, replyToMessageID, threadID interface{}
	if message.ChannelID != "" {
		channelID = message.ChannelID
	}
	if message.ConversationID != "" {
		conversationID = message.ConversationID
	}
	if message.ReplyToMessageID != "" {
		replyToMessageID = message.ReplyToMessageID
	}
	if message.ThreadID != "" {
		threadID = message.ThreadID
	}

	_, err := s.db.Exec(query, message.ID, channelID, conversationID,
		message.AuthorID, message.ContentEncrypted, replyToMessageID, threadID,
		isPinned, message.Timestamp, message.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}

	return nil
}

// GetMessageByID retrieves a message by ID
func (s *MessageService) GetMessageByID(id string) (*models.Message, error) {
	message := &models.Message{}
	query := `
		SELECT id, channel_id, conversation_id, author_id, content_encrypted,
		       reply_to_message_id, thread_id, is_pinned, timestamp, created_at
		FROM messages
		WHERE id = ?
	`

	var convID sql.NullString
	var replyTo sql.NullString
	var threadID sql.NullString
	var isPinned int
	err := s.db.QueryRow(query, id).Scan(
		&message.ID, &message.ChannelID, &convID, &message.AuthorID,
		&message.ContentEncrypted, &replyTo, &threadID,
		&isPinned, &message.Timestamp, &message.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("message not found")
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}
	if convID.Valid {
		message.ConversationID = convID.String
	}
	if replyTo.Valid {
		message.ReplyToMessageID = replyTo.String
	}
	if threadID.Valid {
		message.ThreadID = threadID.String
	}

	message.IsPinned = isPinned == 1
	return message, nil
}

// ListMessagesByChannel lists messages in a channel
func (s *MessageService) ListMessagesByChannel(channelID string, limit, offset int) ([]*models.Message, error) {
	query := `
		SELECT id, channel_id, conversation_id, author_id, content_encrypted,
		       reply_to_message_id, thread_id, is_pinned, timestamp, created_at
		FROM messages
		WHERE channel_id = ?
		ORDER BY timestamp ASC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.Query(query, channelID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		message := &models.Message{}
		var convID sql.NullString
		var replyTo sql.NullString
		var threadID sql.NullString
		var isPinned int
		err := rows.Scan(
			&message.ID, &message.ChannelID, &convID, &message.AuthorID,
			&message.ContentEncrypted, &replyTo, &threadID,
			&isPinned, &message.Timestamp, &message.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		if convID.Valid {
			message.ConversationID = convID.String
		}
		if replyTo.Valid {
			message.ReplyToMessageID = replyTo.String
		}
		if threadID.Valid {
			message.ThreadID = threadID.String
		}
		message.IsPinned = isPinned == 1
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

// ListMessagesByConversation lists messages in a DM conversation
func (s *MessageService) ListMessagesByConversation(conversationID string, limit, offset int) ([]*models.Message, error) {
	query := `
		SELECT id, channel_id, conversation_id, author_id, content_encrypted,
		       reply_to_message_id, thread_id, is_pinned, timestamp, created_at
		FROM messages
		WHERE conversation_id = ?
		ORDER BY timestamp ASC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.Query(query, conversationID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		message := &models.Message{}
		var convID sql.NullString
		var replyTo sql.NullString
		var threadID sql.NullString
		var isPinned int
		err := rows.Scan(
			&message.ID, &message.ChannelID, &convID, &message.AuthorID,
			&message.ContentEncrypted, &replyTo, &threadID,
			&isPinned, &message.Timestamp, &message.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		if convID.Valid {
			message.ConversationID = convID.String
		}
		if replyTo.Valid {
			message.ReplyToMessageID = replyTo.String
		}
		if threadID.Valid {
			message.ThreadID = threadID.String
		}
		message.IsPinned = isPinned == 1
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

// PinMessage pins a message
func (s *MessageService) PinMessage(messageID, pinnedBy string) error {
	// Update message is_pinned flag
	query := `
		UPDATE messages
		SET is_pinned = 1
		WHERE id = ?
	`

	_, err := s.db.Exec(query, messageID)
	if err != nil {
		return fmt.Errorf("failed to pin message: %w", err)
	}

	// Add to pinned_messages table
	pinnedMsg := &models.PinnedMessage{
		ID:        utils.NewULID(),
		MessageID: messageID,
		PinnedBy:  pinnedBy,
		PinnedAt:  utils.GetCurrentTimestamp(),
	}

	insertQuery := `
		INSERT OR REPLACE INTO pinned_messages (id, message_id, pinned_by, pinned_at)
		VALUES (?, ?, ?, ?)
	`

	_, err = s.db.Exec(insertQuery, pinnedMsg.ID, pinnedMsg.MessageID, pinnedMsg.PinnedBy, pinnedMsg.PinnedAt)
	if err != nil {
		return fmt.Errorf("failed to add pinned message: %w", err)
	}

	return nil
}

// UnpinMessage unpins a message
func (s *MessageService) UnpinMessage(messageID string) error {
	// Update message is_pinned flag
	query := `
		UPDATE messages
		SET is_pinned = 0
		WHERE id = ?
	`

	_, err := s.db.Exec(query, messageID)
	if err != nil {
		return fmt.Errorf("failed to unpin message: %w", err)
	}

	// Remove from pinned_messages table
	deleteQuery := `DELETE FROM pinned_messages WHERE message_id = ?`

	_, err = s.db.Exec(deleteQuery, messageID)
	if err != nil {
		return fmt.Errorf("failed to remove pinned message: %w", err)
	}

	return nil
}

// GetPinnedMessages returns all pinned messages for a channel or conversation
func (s *MessageService) GetPinnedMessages(channelID, conversationID string) ([]*models.Message, error) {
	var query string
	var args []interface{}

	if channelID != "" {
		query = `
			SELECT m.id, m.channel_id, m.conversation_id, m.author_id, m.content_encrypted,
			       m.reply_to_message_id, m.thread_id, m.is_pinned, m.timestamp, m.created_at
			FROM messages m
			INNER JOIN pinned_messages pm ON m.id = pm.message_id
			WHERE m.channel_id = ?
			ORDER BY pm.pinned_at DESC
		`
		args = []interface{}{channelID}
	} else if conversationID != "" {
		query = `
			SELECT m.id, m.channel_id, m.conversation_id, m.author_id, m.content_encrypted,
			       m.reply_to_message_id, m.thread_id, m.is_pinned, m.timestamp, m.created_at
			FROM messages m
			INNER JOIN pinned_messages pm ON m.id = pm.message_id
			WHERE m.conversation_id = ?
			ORDER BY pm.pinned_at DESC
		`
		args = []interface{}{conversationID}
	} else {
		return nil, fmt.Errorf("either channel_id or conversation_id must be provided")
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get pinned messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		message := &models.Message{}
		var isPinned int
		err := rows.Scan(
			&message.ID, &message.ChannelID, &message.ConversationID, &message.AuthorID,
			&message.ContentEncrypted, &message.ReplyToMessageID, &message.ThreadID,
			&isPinned, &message.Timestamp, &message.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		message.IsPinned = isPinned == 1
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

// GetReplyPreview retrieves a message for reply preview (returns content snippet)
func (s *MessageService) GetReplyPreview(messageID string) (*models.Message, error) {
	return s.GetMessageByID(messageID)
}
