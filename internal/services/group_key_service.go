package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// GroupKeyService manages sender/group keys storage
type GroupKeyService struct {
	db *sql.DB
}

// NewGroupKeyService creates a new service
func NewGroupKeyService(db *sql.DB) *GroupKeyService {
	return &GroupKeyService{db: db}
}

// SaveSenderKey stores or updates a sender key for a group/channel
func (s *GroupKeyService) SaveSenderKey(groupID, channelID string, keyData []byte, version int) error {
	id := utils.NewULID()
	_, err := s.db.Exec(`
		INSERT INTO group_keys (id, group_id, channel_id, key_data, key_version, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, groupID, channelID, keyData, version, utils.GetCurrentTimestamp())
	if err != nil {
		return fmt.Errorf("save sender key: %w", err)
	}
	return nil
}

// GetLatestSenderKey returns the latest sender key for a group/channel
func (s *GroupKeyService) GetLatestSenderKey(groupID, channelID string) (*models.GroupKey, error) {
	row := s.db.QueryRow(`
		SELECT id, group_id, channel_id, key_data, key_version, created_at
		FROM group_keys
		WHERE group_id = ? AND (channel_id = ? OR ? IS NULL)
		ORDER BY key_version DESC, created_at DESC
		LIMIT 1
	`, groupID, channelID, channelID)

	var key models.GroupKey
	err := row.Scan(&key.ID, &key.GroupID, &key.ChannelID, &key.KeyData, &key.KeyVersion, &key.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get sender key: %w", err)
	}
	return &key, nil
}

// RotateSenderKey stores a new version
func (s *GroupKeyService) RotateSenderKey(groupID, channelID string, keyData []byte, currentVersion int) error {
	return s.SaveSenderKey(groupID, channelID, keyData, currentVersion+1)
}

