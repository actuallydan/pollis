package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// UserService handles user-related operations
// Note: Identity keys are now stored in separate identity_key table
// Note: Username, email, phone are stored in service DB, not locally
type UserService struct {
	db *sql.DB
}

// NewUserService creates a new user service
func NewUserService(db *sql.DB) *UserService {
	return &UserService{db: db}
}

// CreateUser creates a new user
// clerk_id is required
// Identity keys should be managed via IdentityKeyService
func (s *UserService) CreateUser(user *models.User) error {
	if user.ID == "" {
		user.ID = utils.NewULID()
	}
	if user.ClerkID == "" {
		return fmt.Errorf("clerk_id is required")
	}

	query := `
		INSERT INTO users (id, clerk_id, created_at, updated_at)
		VALUES (?, ?, ?, ?)
	`

	now := utils.GetCurrentTimestamp()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := s.db.Exec(query, user.ID, user.ClerkID, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(id string) (*models.User, error) {
	user := &models.User{}

	// Try new schema first (without identity keys)
	query := `
		SELECT id, clerk_id, created_at, updated_at
		FROM users
		WHERE id = ?
	`

	err := s.db.QueryRow(query, id).Scan(
		&user.ID, &user.ClerkID,
		&user.CreatedAt, &user.UpdatedAt,
	)

	// If column doesn't exist, table might still have old schema
	if err != nil && (err.Error() == "sql: expected 4 destination arguments in Scan, not 2" ||
		err.Error() == "no such column: identity_key_public") {
		// Try old schema with identity keys (for backward compatibility during migration)
		queryOld := `
			SELECT id, clerk_id, created_at, updated_at
			FROM users
			WHERE id = ?
		`
		err = s.db.QueryRow(queryOld, id).Scan(
			&user.ID, &user.ClerkID,
			&user.CreatedAt, &user.UpdatedAt,
		)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// GetUserByClerkID retrieves a user by Clerk ID
func (s *UserService) GetUserByClerkID(clerkID string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, clerk_id, created_at, updated_at
		FROM users
		WHERE clerk_id = ?
		LIMIT 1
	`

	err := s.db.QueryRow(query, clerkID).Scan(
		&user.ID, &user.ClerkID,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// GetUserByIdentifier retrieves a user by identifier
// Note: This method is deprecated - username/email/phone are stored in service DB
// Use GetUserByClerkID or query service DB instead
func (s *UserService) GetUserByIdentifier(identifier string) (*models.User, error) {
	// Try by clerk_id first (most common case)
	user, err := s.GetUserByClerkID(identifier)
	if err == nil {
		return user, nil
	}
	return nil, fmt.Errorf("user not found by identifier")
}

// UserExists checks if a user exists by clerk_id
func (s *UserService) UserExists(clerkID string) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM users
		WHERE clerk_id = ?
	`

	err := s.db.QueryRow(query, clerkID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}

	return count > 0, nil
}

// UpdateUser updates user information
// Note: Identity keys should be managed via IdentityKeyService
// This method only updates the updated_at timestamp
func (s *UserService) UpdateUser(user *models.User) error {
	user.UpdatedAt = utils.GetCurrentTimestamp()

	query := `
		UPDATE users
		SET updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, user.UpdatedAt, user.ID)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// DeleteUser deletes a user (use with caution)
func (s *UserService) DeleteUser(id string) error {
	query := `DELETE FROM users WHERE id = ?`
	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

// DeleteUserByClerkID deletes a user by Clerk ID (use with caution)
func (s *UserService) DeleteUserByClerkID(clerkID string) error {
	query := `DELETE FROM users WHERE clerk_id = ?`
	_, err := s.db.Exec(query, clerkID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

// ListUsers lists all users (for admin/debugging purposes)
func (s *UserService) ListUsers() ([]*models.User, error) {
	query := `
		SELECT id, clerk_id, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID, &user.ClerkID,
			&user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	return users, rows.Err()
}
