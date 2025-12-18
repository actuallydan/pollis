package services

import (
	"fmt"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

// SenderKeyService manages sender keys for groups/channels
type SenderKeyService struct {
	db          *database.DB
	authService *AuthService
}

func NewSenderKeyService(db *database.DB) *SenderKeyService {
	return &SenderKeyService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// GetSenderKey fetches the latest sender key for group/channel
func (s *SenderKeyService) GetSenderKey(groupID, channelID string) (*models.SenderKey, error) {
	if err := utils.ValidateUserID(groupID); err != nil {
		return nil, err
	}
	if err := utils.ValidateUserID(channelID); err != nil {
		return nil, err
	}

	var key models.SenderKey
	err := s.db.GetConn().QueryRow(`
		SELECT id, group_id, channel_id, sender_key, key_version, created_at, updated_at
		FROM sender_keys
		WHERE group_id = ? AND channel_id = ?
		ORDER BY key_version DESC, created_at DESC
		LIMIT 1
	`, groupID, channelID).Scan(
		&key.ID,
		&key.GroupID,
		&key.ChannelID,
		&key.SenderKey,
		&key.KeyVersion,
		&key.CreatedAt,
		&key.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("sender key not found: %w", err)
	}
	return &key, nil
}

// DistributeSenderKey stores/rotates sender key and records recipients
func (s *SenderKeyService) DistributeSenderKey(groupID, channelID string, senderKey []byte, keyVersion int32, recipients []string) error {
	if err := utils.ValidateUserID(groupID); err != nil {
		return err
	}
	if err := utils.ValidateUserID(channelID); err != nil {
		return err
	}
	if len(senderKey) == 0 {
		return fmt.Errorf("sender key cannot be empty")
	}
	if keyVersion <= 0 {
		return fmt.Errorf("key version must be positive")
	}

	// Verify group and channel exist
	groupExists, err := s.authService.GroupExists(groupID)
	if err != nil {
		return err
	}
	if !groupExists {
		return fmt.Errorf("group not found")
	}

	channelExists, err := s.authService.ChannelExists(channelID)
	if err != nil {
		return err
	}
	if !channelExists {
		return fmt.Errorf("channel not found")
	}

	// Verify recipients are members (best-effort; skip invalid)
	validRecipients := make([]string, 0, len(recipients))
	for _, r := range recipients {
		if r == "" {
			continue
		}
		if err := utils.ValidateUserIdentifier(r); err != nil {
			continue
		}
		isMember, err := s.authService.IsGroupMember(groupID, r)
		if err == nil && isMember {
			validRecipients = append(validRecipients, r)
		}
	}

	now := utils.GetCurrentTimestamp()
	senderKeyID := utils.NewULID()

	// Upsert sender key (unique per group/channel)
	_, err = s.db.GetConn().Exec(`
		INSERT INTO sender_keys (id, group_id, channel_id, sender_key, key_version, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(group_id, channel_id) DO UPDATE SET
			sender_key = excluded.sender_key,
			key_version = excluded.key_version,
			updated_at = excluded.updated_at
	`, senderKeyID, groupID, channelID, senderKey, keyVersion, now, now)
	if err != nil {
		return fmt.Errorf("failed to store sender key: %w", err)
	}

	// Fetch actual sender_key_id (in case of conflict we need existing id)
	err = s.db.GetConn().QueryRow(`
		SELECT id FROM sender_keys WHERE group_id = ? AND channel_id = ?
	`, groupID, channelID).Scan(&senderKeyID)
	if err != nil {
		return fmt.Errorf("failed to load sender key id: %w", err)
	}

	// Clean existing recipients for this sender key and insert new ones
	_, _ = s.db.GetConn().Exec(`DELETE FROM sender_key_recipients WHERE sender_key_id = ?`, senderKeyID)

	for _, r := range validRecipients {
		recipientID := utils.NewULID()
		_, err = s.db.GetConn().Exec(`
			INSERT INTO sender_key_recipients (id, sender_key_id, recipient_identifier, created_at)
			VALUES (?, ?, ?, ?)
		`, recipientID, senderKeyID, r, now)
		if err != nil {
			return fmt.Errorf("failed to insert sender key recipient: %w", err)
		}
	}

	return nil
}
