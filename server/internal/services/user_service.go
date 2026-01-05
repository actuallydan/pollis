package services

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

type UserService struct {
	db *database.DB
}

func NewUserService(db *database.DB) *UserService {
	return &UserService{db: db}
}

// RegisterUser creates or updates a user in the service
// Now includes username, email, phone, and avatar_url fields
func (s *UserService) RegisterUser(userID, clerkID string, username *string, email, phone, avatarURL *string) error {
	// Validate inputs
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}
	if clerkID == "" {
		return fmt.Errorf("clerk_id is required")
	}

	now := utils.GetCurrentTimestamp()

	// Check if user already exists
	var exists bool
	err := s.db.GetConn().QueryRow(
		"SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)",
		userID,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check user existence: %w", err)
	}

	if exists {
		// User already exists - update all fields (allow overwriting)
		if username != nil || email != nil || phone != nil || avatarURL != nil {
			query := "UPDATE users SET"
			args := []interface{}{}
			updates := []string{}

			// Always update username if provided
			if username != nil {
				updates = append(updates, " username = ?")
				args = append(args, *username)
			}
			// Always update email if provided
			if email != nil {
				updates = append(updates, " email = ?")
				args = append(args, *email)
			}
			// Always update phone if provided
			if phone != nil {
				updates = append(updates, " phone = ?")
				args = append(args, *phone)
			}
			// Always update avatar_url if provided
			if avatarURL != nil {
				updates = append(updates, " avatar_url = ?")
				args = append(args, *avatarURL)
			}

			if len(updates) > 0 {
				query += strings.Join(updates, ",") + " WHERE id = ?"
				args = append(args, userID)
				_, err = s.db.GetConn().Exec(query, args...)
				if err != nil {
					return fmt.Errorf("failed to update user: %w", err)
				}
			}
		}
		return nil
	} else {
		// Insert new user with username, email, phone, and avatar_url
		_, err = s.db.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, username, email, phone, avatar_url, created_at, disabled)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0)
		`, userID, clerkID, username, email, phone, avatarURL, now)
		if err != nil {
			return fmt.Errorf("failed to insert user: %w", err)
		}
	}

	return nil
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(userID string) (*models.User, error) {
	if err := utils.ValidateUserID(userID); err != nil {
		return nil, err
	}

	user := &models.User{}
	err := s.db.GetConn().QueryRow(`
		SELECT id, clerk_id, username, email, phone, avatar_url, created_at, disabled
		FROM users
		WHERE id = ?
	`, userID).Scan(
		&user.ID,
		&user.ClerkID,
		&user.Username,
		&user.Email,
		&user.Phone,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.Disabled,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// GetUserByClerkID retrieves a user by Clerk ID
func (s *UserService) GetUserByClerkID(clerkID string) (*models.User, error) {
	if clerkID == "" {
		return nil, fmt.Errorf("clerk_id is required")
	}

	user := &models.User{}
	err := s.db.GetConn().QueryRow(`
		SELECT id, clerk_id, username, email, phone, avatar_url, created_at, disabled
		FROM users
		WHERE clerk_id = ?
	`, clerkID).Scan(
		&user.ID,
		&user.ClerkID,
		&user.Username,
		&user.Email,
		&user.Phone,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.Disabled,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// DisableUser marks a user as disabled
func (s *UserService) DisableUser(userID string) error {
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}

	_, err := s.db.GetConn().Exec(`
		UPDATE users
		SET disabled = 1
		WHERE id = ?
	`, userID)
	if err != nil {
		return fmt.Errorf("failed to disable user: %w", err)
	}

	return nil
}

// EnableUser re-enables a disabled user
func (s *UserService) EnableUser(userID string) error {
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}

	_, err := s.db.GetConn().Exec(`
		UPDATE users
		SET disabled = 0
		WHERE id = ?
	`, userID)
	if err != nil {
		return fmt.Errorf("failed to enable user: %w", err)
	}

	return nil
}

// GetUser retrieves a user by identifier (deprecated - kept for backward compatibility)
// Note: In the new schema, username/email/phone are not stored in the user table
// This method is kept for backward compatibility but will only work with user IDs
func (s *UserService) GetUser(userIdentifier string) (*models.User, error) {
	return s.GetUserByID(userIdentifier)
}

// SearchUsers is deprecated in the new schema (no username/email/phone fields)
// Returns empty list for backward compatibility
func (s *UserService) SearchUsers(query string, limit int32) ([]*models.User, error) {
	// In the new schema, user search is not supported at the service level
	// User discovery should happen via Clerk (email/phone lookup)
	return []*models.User{}, nil
}
