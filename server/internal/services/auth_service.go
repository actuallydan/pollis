package services

import (
	"database/sql"
	"errors"
	"fmt"

	"pollis-service/internal/database"
)

type AuthService struct {
	db *database.DB
}

func NewAuthService(db *database.DB) *AuthService {
	return &AuthService{db: db}
}

// UserExists checks if a user exists by ID
func (s *AuthService) UserExists(userID string) (bool, error) {
	var exists bool
	err := s.db.GetConn().QueryRow(
		"SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)",
		userID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}
	return exists, nil
}

// UserExistsByIdentifier checks if a user exists by identifier (username, email, or phone)
func (s *AuthService) UserExistsByIdentifier(identifier string) (bool, error) {
	var exists bool
	err := s.db.GetConn().QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM users 
			WHERE username = ? OR email = ? OR phone = ?
		)
	`, identifier, identifier, identifier).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}
	return exists, nil
}

// IsGroupMember checks if a user is a member of a group
func (s *AuthService) IsGroupMember(groupID, userIdentifier string) (bool, error) {
	var isMember bool
	err := s.db.GetConn().QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_member 
			WHERE group_id = ? AND user_id = ?
		)
	`, groupID, userIdentifier).Scan(&isMember)
	if err != nil {
		return false, fmt.Errorf("failed to check group membership: %w", err)
	}
	return isMember, nil
}

// IsGroupCreator checks if a user is the creator of a group
func (s *AuthService) IsGroupCreator(groupID, userID string) (bool, error) {
	var createdBy string
	err := s.db.GetConn().QueryRow(
		"SELECT created_by FROM groups WHERE id = ?",
		groupID,
	).Scan(&createdBy)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, fmt.Errorf("group not found")
		}
		return false, fmt.Errorf("failed to check group creator: %w", err)
	}
	return createdBy == userID, nil
}

// GroupExists checks if a group exists
func (s *AuthService) GroupExists(groupID string) (bool, error) {
	var exists bool
	err := s.db.GetConn().QueryRow(
		"SELECT EXISTS(SELECT 1 FROM groups WHERE id = ?)",
		groupID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check group existence: %w", err)
	}
	return exists, nil
}

// ChannelExists checks if a channel exists
func (s *AuthService) ChannelExists(channelID string) (bool, error) {
	var exists bool
	err := s.db.GetConn().QueryRow(
		"SELECT EXISTS(SELECT 1 FROM channel WHERE id = ?)",
		channelID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check channel existence: %w", err)
	}
	return exists, nil
}
