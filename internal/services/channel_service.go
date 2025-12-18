package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// ChannelService handles channel-related operations
type ChannelService struct {
	db *sql.DB
}

// NewChannelService creates a new channel service
func NewChannelService(db *sql.DB) *ChannelService {
	return &ChannelService{db: db}
}

// CreateChannel creates a new channel
func (s *ChannelService) CreateChannel(channel *models.Channel) error {
	if channel.ID == "" {
		channel.ID = utils.NewULID()
	}

	if channel.ChannelType == "" {
		channel.ChannelType = "text"
	}

	if channel.Slug == "" {
		return fmt.Errorf("channel slug is required")
	}

	query := `
		INSERT INTO channels (id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	now := utils.GetCurrentTimestamp()
	channel.CreatedAt = now
	channel.UpdatedAt = now

	_, err := s.db.Exec(query, channel.ID, channel.GroupID, channel.Slug, channel.Name, channel.Description,
		channel.ChannelType, channel.CreatedBy, channel.CreatedAt, channel.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create channel: %w", err)
	}

	return nil
}

// GetChannelByID retrieves a channel by ID
func (s *ChannelService) GetChannelByID(id string) (*models.Channel, error) {
	channel := &models.Channel{}
	query := `
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channels
		WHERE id = ?
	`

	err := s.db.QueryRow(query, id).Scan(
		&channel.ID, &channel.GroupID, &channel.Slug, &channel.Name, &channel.Description,
		&channel.ChannelType, &channel.CreatedBy, &channel.CreatedAt, &channel.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}

	return channel, nil
}

// ListChannelsByGroup lists all channels in a group
func (s *ChannelService) ListChannelsByGroup(groupID string) ([]*models.Channel, error) {
	query := `
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channels
		WHERE group_id = ?
		ORDER BY created_at ASC
	`

	rows, err := s.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list channels: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel
	for rows.Next() {
		channel := &models.Channel{}
		err := rows.Scan(
			&channel.ID, &channel.GroupID, &channel.Slug, &channel.Name, &channel.Description,
			&channel.ChannelType, &channel.CreatedBy, &channel.CreatedAt, &channel.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel: %w", err)
		}
		channels = append(channels, channel)
	}

	return channels, rows.Err()
}

// UpdateChannel updates channel information
func (s *ChannelService) UpdateChannel(channel *models.Channel) error {
	channel.UpdatedAt = utils.GetCurrentTimestamp()

	query := `
		UPDATE channels
		SET name = ?, description = ?, updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, channel.Name, channel.Description, channel.UpdatedAt, channel.ID)
	if err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}

	return nil
}

// DeleteChannel deletes a channel
func (s *ChannelService) DeleteChannel(channelID string) error {
	query := `DELETE FROM channels WHERE id = ?`

	_, err := s.db.Exec(query, channelID)
	if err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}

	return nil
}

// ChannelExistsBySlug checks if a channel with the given slug exists in the group
func (s *ChannelService) ChannelExistsBySlug(groupID, slug string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM channels WHERE group_id = ? AND slug = ?)`
	
	err := s.db.QueryRow(query, groupID, slug).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check channel existence: %w", err)
	}
	
	return exists, nil
}

// GetChannelBySlug retrieves a channel by group ID and slug
func (s *ChannelService) GetChannelBySlug(groupID, slug string) (*models.Channel, error) {
	channel := &models.Channel{}
	query := `
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channels
		WHERE group_id = ? AND slug = ?
	`

	err := s.db.QueryRow(query, groupID, slug).Scan(
		&channel.ID, &channel.GroupID, &channel.Slug, &channel.Name, &channel.Description,
		&channel.ChannelType, &channel.CreatedBy, &channel.CreatedAt, &channel.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}

	return channel, nil
}
