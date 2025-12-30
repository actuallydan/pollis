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
// Now includes email and phone fields
func (s *UserService) RegisterUser(userID, clerkID string, email, phone *string) error {
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
		// User already exists - only set email/phone if not already set (don't overwrite)
		if email != nil || phone != nil {
			// First check what's already in the database
			var existingEmail, existingPhone sql.NullString
			err = s.db.GetConn().QueryRow(
				"SELECT email, phone FROM users WHERE id = ?",
				userID,
			).Scan(&existingEmail, &existingPhone)
			if err != nil {
				return fmt.Errorf("failed to check existing user data: %w", err)
			}

			query := "UPDATE users SET"
			args := []interface{}{}
			updates := []string{}

			// Only update email if not already set
			if email != nil && !existingEmail.Valid {
				updates = append(updates, " email = ?")
				args = append(args, *email)
			}
			// Only update phone if not already set
			if phone != nil && !existingPhone.Valid {
				updates = append(updates, " phone = ?")
				args = append(args, *phone)
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
		// Insert new user with email and phone
		_, err = s.db.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, email, phone, created_at, disabled)
			VALUES (?, ?, ?, ?, ?, 0)
		`, userID, clerkID, email, phone, now)
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
		SELECT id, clerk_id, created_at, disabled
		FROM users
		WHERE id = ?
	`, userID).Scan(
		&user.ID,
		&user.ClerkID,
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
		SELECT id, clerk_id, created_at, disabled
		FROM users
		WHERE clerk_id = ?
	`, clerkID).Scan(
		&user.ID,
		&user.ClerkID,
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
