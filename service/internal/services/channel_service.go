package services

import (
	"database/sql"
	"errors"
	"fmt"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

type ChannelService struct {
	db          *database.DB
	authService *AuthService
}

func NewChannelService(db *database.DB) *ChannelService {
	return &ChannelService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// CreateChannel creates a new channel in a group
func (s *ChannelService) CreateChannel(channelID, groupID, slug, name string, description *string, createdBy string) error {
	// Validate inputs
	if err := utils.ValidateUserID(channelID); err != nil {
		return err
	}
	if err := utils.ValidateUserID(groupID); err != nil {
		return err
	}
	if slug == "" {
		return fmt.Errorf("channel slug is required")
	}
	if err := utils.ValidateChannelName(name); err != nil {
		return err
	}
	if err := utils.ValidateUserIdentifier(createdBy); err != nil {
		return err
	}

	// Verify group exists
	exists, err := s.authService.GroupExists(groupID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("group not found")
	}

	// Verify creator is a member of the group
	isMember, err := s.authService.IsGroupMember(groupID, createdBy)
	if err != nil {
		return err
	}
	if !isMember {
		return fmt.Errorf("only group members can create channels")
	}

	now := utils.GetCurrentTimestamp()
	_, err = s.db.GetConn().Exec(`
		INSERT INTO channels (id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'text', ?, ?, ?)
	`, channelID, groupID, slug, name, description, createdBy, now, now)
	if err != nil {
		return fmt.Errorf("failed to create channel: %w", err)
	}

	return nil
}

// ListChannels lists all channels in a group
func (s *ChannelService) ListChannels(groupID string) ([]*models.Channel, error) {
	// Validate inputs
	if err := utils.ValidateUserID(groupID); err != nil {
		return nil, err
	}

	// Verify group exists
	exists, err := s.authService.GroupExists(groupID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("group not found")
	}

	rows, err := s.db.GetConn().Query(`
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channels
		WHERE group_id = ?
		ORDER BY created_at ASC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list channels: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel
	for rows.Next() {
		channel := &models.Channel{}
		var description sql.NullString

		err := rows.Scan(
			&channel.ID,
			&channel.GroupID,
			&channel.Slug,
			&channel.Name,
			&description,
			&channel.ChannelType,
			&channel.CreatedBy,
			&channel.CreatedAt,
			&channel.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel: %w", err)
		}

		if description.Valid {
			channel.Description = description.String
		}

		channels = append(channels, channel)
	}

	return channels, rows.Err()
}

// GetChannel retrieves a channel by ID
func (s *ChannelService) GetChannel(channelID string) (*models.Channel, error) {
	channel := &models.Channel{}
	var description sql.NullString

	err := s.db.GetConn().QueryRow(`
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channels
		WHERE id = ?
	`, channelID).Scan(
		&channel.ID,
		&channel.GroupID,
		&channel.Slug,
		&channel.Name,
		&description,
		&channel.ChannelType,
		&channel.CreatedBy,
		&channel.CreatedAt,
		&channel.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}

	if description.Valid {
		channel.Description = description.String
	}

	return channel, nil
}

// ChannelExistsBySlug checks if a channel with the given slug exists in the group
func (s *ChannelService) ChannelExistsBySlug(groupID, slug string) (bool, error) {
	var exists bool
	err := s.db.GetConn().QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channels WHERE group_id = ? AND slug = ?)
	`, groupID, slug).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check channel existence: %w", err)
	}
	return exists, nil
}
