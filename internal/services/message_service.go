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

	if message.CreatedAt == 0 {
		message.CreatedAt = utils.GetCurrentTimestamp()
	}

	query := `
		INSERT INTO message (id, conversation_id, channel_id, sender_id, ciphertext, nonce, created_at, delivered)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	delivered := 0
	if message.Delivered {
		delivered = 1
	}

	_, err := s.db.Exec(query, message.ID, message.ConversationID, message.ChannelID,
		message.SenderID, message.Ciphertext, message.Nonce, message.CreatedAt, delivered)
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}

	return nil
}

// GetMessageByID retrieves a message by ID
func (s *MessageService) GetMessageByID(id string) (*models.Message, error) {
	message := &models.Message{}
	query := `
		SELECT id, conversation_id, channel_id, sender_id, ciphertext, nonce, created_at, delivered
		FROM message
		WHERE id = ?
	`

	var delivered int
	var channelID sql.NullString
	err := s.db.QueryRow(query, id).Scan(
		&message.ID, &message.ConversationID, &channelID, &message.SenderID,
		&message.Ciphertext, &message.Nonce, &message.CreatedAt, &delivered,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("message not found")
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	message.Delivered = delivered == 1
	if channelID.Valid {
		message.ChannelID = channelID.String
	}
	return message, nil
}

// ListMessagesByChannel lists messages in a channel (deprecated - use ListMessagesByConversation)
func (s *MessageService) ListMessagesByChannel(channelID string, limit, offset int) ([]*models.Message, error) {
	// In new schema, channels don't have separate messages - use conversation_id
	return s.ListMessagesByConversation(channelID, limit, offset)
}

// ListMessagesByConversation lists messages in a conversation
func (s *MessageService) ListMessagesByConversation(conversationID string, limit, offset int) ([]*models.Message, error) {
	query := `
		SELECT id, conversation_id, channel_id, sender_id, ciphertext, nonce, created_at, delivered
		FROM message
		WHERE conversation_id = ? OR channel_id = ?
		ORDER BY created_at ASC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.Query(query, conversationID, conversationID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		message := &models.Message{}
		var delivered int
		var channelID sql.NullString
		err := rows.Scan(
			&message.ID, &message.ConversationID, &channelID, &message.SenderID,
			&message.Ciphertext, &message.Nonce, &message.CreatedAt, &delivered,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		message.Delivered = delivered == 1
		if channelID.Valid {
			message.ChannelID = channelID.String
		}
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

// PinMessage pins a message (deprecated - pinning not implemented in new schema)
func (s *MessageService) PinMessage(messageID, pinnedBy string) error {
	return fmt.Errorf("message pinning not yet implemented in new schema")
}

// UnpinMessage unpins a message (deprecated - pinning not implemented in new schema)
func (s *MessageService) UnpinMessage(messageID string) error {
	return fmt.Errorf("message pinning not yet implemented in new schema")
}

// GetPinnedMessages returns all pinned messages for a conversation (deprecated - pinning not implemented in new schema)
func (s *MessageService) GetPinnedMessages(channelID, conversationID string) ([]*models.Message, error) {
	return nil, fmt.Errorf("message pinning not yet implemented in new schema")
}

// GetReplyPreview retrieves a message for reply preview (returns content snippet)
func (s *MessageService) GetReplyPreview(messageID string) (*models.Message, error) {
	return s.GetMessageByID(messageID)
}
