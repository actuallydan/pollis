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
// clerkID is now required (not optional)
func (s *UserService) RegisterUser(userID, clerkID, username string, email, phone, avatarURL *string, publicKey []byte) error {
	// Validate inputs
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}
	if clerkID == "" {
		return fmt.Errorf("clerk_id is required")
	}
	if err := utils.ValidateUsername(username); err != nil {
		return err
	}
	if email != nil && *email != "" {
		if err := utils.ValidateEmail(*email); err != nil {
			return err
		}
	}
	if phone != nil && *phone != "" {
		if err := utils.ValidatePhone(*phone); err != nil {
			return err
		}
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
		// Update existing user
		_, err = s.db.GetConn().Exec(`
			UPDATE users 
			SET username = ?, email = ?, phone = ?, avatar_url = ?, public_key = ?, clerk_id = ?, updated_at = ?
			WHERE id = ?
		`, username, email, phone, avatarURL, publicKey, clerkID, now, userID)
		if err != nil {
			return fmt.Errorf("failed to update user: %w", err)
		}
	} else {
		// Insert new user (clerk_id is now required)
		_, err = s.db.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, username, email, phone, avatar_url, public_key, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, userID, clerkID, username, email, phone, avatarURL, publicKey, now, now)
		if err != nil {
			return fmt.Errorf("failed to insert user: %w", err)
		}
	}

	return nil
}

// GetUser retrieves a user by identifier (username, email, or phone)
func (s *UserService) GetUser(userIdentifier string) (*models.User, error) {
	if err := utils.ValidateUserIdentifier(userIdentifier); err != nil {
		return nil, err
	}

	user := &models.User{}
	var email, phone, avatarURL sql.NullString
	var publicKey []byte

	err := s.db.GetConn().QueryRow(`
		SELECT id, clerk_id, username, email, phone, avatar_url, public_key, created_at, updated_at
		FROM users
		WHERE username = ? OR email = ? OR phone = ?
		LIMIT 1
	`, userIdentifier, userIdentifier, userIdentifier).Scan(
		&user.ID,
		&user.ClerkID,
		&user.Username,
		&email,
		&phone,
		&avatarURL,
		&publicKey,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if email.Valid {
		user.Email = email.String
	}
	if phone.Valid {
		user.Phone = phone.String
	}
	if avatarURL.Valid {
		user.AvatarURL = avatarURL.String
	}
	if publicKey != nil {
		user.PublicKey = publicKey
	}

	return user, nil
}

// SearchUsers searches for users by query (username, email, or phone)
func (s *UserService) SearchUsers(query string, limit int32) ([]*models.User, error) {
	if query == "" {
		return []*models.User{}, nil
	}
	if len(query) < 2 {
		return []*models.User{}, nil // Require at least 2 characters for search
	}
	if limit <= 0 || limit > 100 {
		limit = 20 // Default limit
	}

	searchPattern := "%" + strings.ToLower(query) + "%"

	rows, err := s.db.GetConn().Query(`
		SELECT id, clerk_id, username, email, phone, public_key, created_at, updated_at
		FROM users
		WHERE LOWER(username) LIKE ? 
		   OR LOWER(email) LIKE ? 
		   OR LOWER(phone) LIKE ?
		LIMIT ?
	`, searchPattern, searchPattern, searchPattern, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		user := &models.User{}
		var email, phone sql.NullString
		var publicKey []byte

		err := rows.Scan(
			&user.ID,
			&user.ClerkID,
			&user.Username,
			&email,
			&phone,
			&publicKey,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}

		if email.Valid {
			user.Email = email.String
		}
		if phone.Valid {
			user.Phone = phone.String
		}
		if publicKey != nil {
			user.PublicKey = publicKey
		}

		users = append(users, user)
	}

	return users, rows.Err()
}

// GetUserByClerkID retrieves a user by Clerk ID
func (s *UserService) GetUserByClerkID(clerkID string) (*models.User, error) {
	if clerkID == "" {
		return nil, fmt.Errorf("clerk_id cannot be empty")
	}

	user := &models.User{}
	var email, phone, avatarURL sql.NullString
	var publicKey []byte

	err := s.db.GetConn().QueryRow(`
		SELECT id, clerk_id, username, email, phone, avatar_url, public_key, created_at, updated_at
		FROM users
		WHERE clerk_id = ?
	`, clerkID).Scan(
		&user.ID,
		&user.ClerkID,
		&user.Username,
		&email,
		&phone,
		&avatarURL,
		&publicKey,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found (return nil, not error)
		}
		return nil, fmt.Errorf("failed to get user by clerk_id: %w", err)
	}

	if email.Valid {
		user.Email = email.String
	}
	if phone.Valid {
		user.Phone = phone.String
	}
	if avatarURL.Valid {
		user.AvatarURL = avatarURL.String
	}
	if publicKey != nil {
		user.PublicKey = publicKey
	}

	return user, nil
}
