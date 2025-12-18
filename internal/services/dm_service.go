package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// DMService handles direct message conversation operations
type DMService struct {
	db *sql.DB
}

// NewDMService creates a new DM service
func NewDMService(db *sql.DB) *DMService {
	return &DMService{db: db}
}

// CreateOrGetConversation creates a new DM conversation or returns existing one
func (s *DMService) CreateOrGetConversation(user1ID, user2Identifier string) (*models.DMConversation, error) {
	// Check if conversation already exists
	conv, err := s.GetConversation(user1ID, user2Identifier)
	if err == nil && conv != nil {
		return conv, nil
	}

	// Create new conversation
	conv = &models.DMConversation{
		ID:              utils.NewULID(),
		User1ID:         user1ID,
		User2Identifier: user2Identifier,
		CreatedAt:       utils.GetCurrentTimestamp(),
		UpdatedAt:       utils.GetCurrentTimestamp(),
	}

	query := `
		INSERT INTO dm_conversations (id, user1_id, user2_identifier, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err = s.db.Exec(query, conv.ID, conv.User1ID, conv.User2Identifier, conv.CreatedAt, conv.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	return conv, nil
}

// GetConversation retrieves a conversation by user IDs
func (s *DMService) GetConversation(user1ID, user2Identifier string) (*models.DMConversation, error) {
	conv := &models.DMConversation{}
	query := `
		SELECT id, user1_id, user2_identifier, created_at, updated_at
		FROM dm_conversations
		WHERE user1_id = ? AND user2_identifier = ?
	`

	err := s.db.QueryRow(query, user1ID, user2Identifier).Scan(
		&conv.ID, &conv.User1ID, &conv.User2Identifier, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("conversation not found")
		}
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	return conv, nil
}

// GetConversationByID retrieves a conversation by ID
func (s *DMService) GetConversationByID(conversationID string) (*models.DMConversation, error) {
	conv := &models.DMConversation{}
	query := `
		SELECT id, user1_id, user2_identifier, created_at, updated_at
		FROM dm_conversations
		WHERE id = ?
	`

	err := s.db.QueryRow(query, conversationID).Scan(
		&conv.ID, &conv.User1ID, &conv.User2Identifier, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("conversation not found")
		}
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	return conv, nil
}

// ListUserConversations lists all DM conversations for a user
func (s *DMService) ListUserConversations(userID string) ([]*models.DMConversation, error) {
	query := `
		SELECT id, user1_id, user2_identifier, created_at, updated_at
		FROM dm_conversations
		WHERE user1_id = ?
		ORDER BY updated_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list conversations: %w", err)
	}
	defer rows.Close()

	var conversations []*models.DMConversation
	for rows.Next() {
		conv := &models.DMConversation{}
		err := rows.Scan(
			&conv.ID, &conv.User1ID, &conv.User2Identifier, &conv.CreatedAt, &conv.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %w", err)
		}
		conversations = append(conversations, conv)
	}

	return conversations, rows.Err()
}

// UpdateConversationTimestamp updates the updated_at timestamp of a conversation
func (s *DMService) UpdateConversationTimestamp(conversationID string) error {
	query := `
		UPDATE dm_conversations
		SET updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, utils.GetCurrentTimestamp(), conversationID)
	if err != nil {
		return fmt.Errorf("failed to update conversation timestamp: %w", err)
	}

	return nil
}

