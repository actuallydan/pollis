package services

import (
	"database/sql"
	"fmt"
	"time"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

type KeyExchangeService struct {
	db          *database.DB
	authService *AuthService
}

func NewKeyExchangeService(db *database.DB) *KeyExchangeService {
	return &KeyExchangeService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// SendKeyExchange stores a key exchange message
func (s *KeyExchangeService) SendKeyExchange(fromUserID, toUserIdentifier, messageType string, encryptedData []byte, expiresInSeconds int64) (string, error) {
	// Validate inputs
	if err := utils.ValidateUserID(fromUserID); err != nil {
		return "", err
	}
	if err := utils.ValidateUserIdentifier(toUserIdentifier); err != nil {
		return "", err
	}
	if messageType == "" {
		return "", fmt.Errorf("message type cannot be empty")
	}
	if len(encryptedData) == 0 {
		return "", fmt.Errorf("encrypted data cannot be empty")
	}

	// Verify sender exists
	userExists, err := s.authService.UserExists(fromUserID)
	if err != nil {
		return "", err
	}
	if !userExists {
		return "", fmt.Errorf("sender user does not exist")
	}

	messageID := utils.NewULID()
	now := utils.GetCurrentTimestamp()

	var expiresAt *int64
	if expiresInSeconds > 0 {
		exp := now + expiresInSeconds
		expiresAt = &exp
	}

	_, err = s.db.GetConn().Exec(`
		INSERT INTO key_exchange_messages (id, from_user_id, to_user_identifier, message_type, encrypted_data, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, messageID, fromUserID, toUserIdentifier, messageType, encryptedData, now, expiresAt)
	if err != nil {
		return "", fmt.Errorf("failed to send key exchange: %w", err)
	}

	return messageID, nil
}

// GetKeyExchangeMessages retrieves all key exchange messages for a user
func (s *KeyExchangeService) GetKeyExchangeMessages(userIdentifier string) ([]*models.KeyExchangeMessage, error) {
	// Validate inputs
	if err := utils.ValidateUserIdentifier(userIdentifier); err != nil {
		return nil, err
	}

	now := utils.GetCurrentTimestamp()

	rows, err := s.db.GetConn().Query(`
		SELECT id, from_user_id, message_type, encrypted_data, created_at, expires_at
		FROM key_exchange_messages
		WHERE to_user_identifier = ? 
		  AND (expires_at IS NULL OR expires_at > ?)
		ORDER BY created_at ASC
	`, userIdentifier, now)
	if err != nil {
		return nil, fmt.Errorf("failed to get key exchange messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.KeyExchangeMessage
	for rows.Next() {
		msg := &models.KeyExchangeMessage{
			ToUserIdentifier: userIdentifier,
		}
		var expiresAt sql.NullInt64

		err := rows.Scan(
			&msg.ID,
			&msg.FromUserID,
			&msg.MessageType,
			&msg.EncryptedData,
			&msg.CreatedAt,
			&expiresAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan key exchange message: %w", err)
		}

		if expiresAt.Valid {
			msg.ExpiresAt = &expiresAt.Int64
		}

		messages = append(messages, msg)
	}

	return messages, rows.Err()
}

// MarkKeyExchangeRead deletes key exchange messages (marking them as read)
func (s *KeyExchangeService) MarkKeyExchangeRead(messageIDs []string) error {
	if len(messageIDs) == 0 {
		return nil
	}

	// Build query with placeholders
	placeholders := ""
	args := make([]interface{}, len(messageIDs))
	for i, id := range messageIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}

	_, err := s.db.GetConn().Exec(
		fmt.Sprintf("DELETE FROM key_exchange_messages WHERE id IN (%s)", placeholders),
		args...,
	)
	if err != nil {
		return fmt.Errorf("failed to mark key exchange messages as read: %w", err)
	}

	return nil
}

// CleanupExpiredMessages removes expired key exchange messages
func (s *KeyExchangeService) CleanupExpiredMessages() error {
	now := utils.GetCurrentTimestamp()
	_, err := s.db.GetConn().Exec(`
		DELETE FROM key_exchange_messages
		WHERE expires_at IS NOT NULL AND expires_at <= ?
	`, now)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired messages: %w", err)
	}
	return nil
}

// StartCleanupRoutine starts a background routine to clean up expired messages
func (s *KeyExchangeService) StartCleanupRoutine(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			if err := s.CleanupExpiredMessages(); err != nil {
				// Log error (in production, use proper logging)
				fmt.Printf("Error cleaning up expired key exchange messages: %v\n", err)
			}
		}
	}()
}
