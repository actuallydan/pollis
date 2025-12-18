package services

import (
	"database/sql"
	"errors"
	"fmt"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

type KeyBackupService struct {
	db          *database.DB
	authService *AuthService
}

func NewKeyBackupService(db *database.DB) *KeyBackupService {
	return &KeyBackupService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// StoreKeyBackup stores or updates an encrypted key backup for a user
func (s *KeyBackupService) StoreKeyBackup(userID string, encryptedKey []byte) error {
	// Validate inputs
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}
	if len(encryptedKey) == 0 {
		return fmt.Errorf("encrypted key cannot be empty")
	}

	// Verify user exists
	exists, err := s.authService.UserExists(userID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("user does not exist")
	}

	now := utils.GetCurrentTimestamp()

	// Use INSERT OR REPLACE for upsert
	_, err = s.db.GetConn().Exec(`
		INSERT OR REPLACE INTO key_backups (user_id, encrypted_key, updated_at)
		VALUES (?, ?, ?)
	`, userID, encryptedKey, now)
	if err != nil {
		return fmt.Errorf("failed to store key backup: %w", err)
	}

	return nil
}

// GetKeyBackup retrieves an encrypted key backup for a user
func (s *KeyBackupService) GetKeyBackup(userID string) (*models.KeyBackup, error) {
	// Validate inputs
	if err := utils.ValidateUserID(userID); err != nil {
		return nil, err
	}

	backup := &models.KeyBackup{}

	err := s.db.GetConn().QueryRow(`
		SELECT user_id, encrypted_key, updated_at
		FROM key_backups
		WHERE user_id = ?
	`, userID).Scan(
		&backup.UserID,
		&backup.EncryptedKey,
		&backup.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("key backup not found")
		}
		return nil, fmt.Errorf("failed to get key backup: %w", err)
	}

	return backup, nil
}
