package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// UserService handles user-related operations
// Note: username, email, phone are stored in service DB, not locally
type UserService struct {
	db *sql.DB
}

// NewUserService creates a new user service
func NewUserService(db *sql.DB) *UserService {
	return &UserService{db: db}
}

// CreateUser creates a new user
// clerk_id is required
func (s *UserService) CreateUser(user *models.User) error {
	if user.ID == "" {
		user.ID = utils.NewULID()
	}
	if user.ClerkID == "" {
		return fmt.Errorf("clerk_id is required")
	}

	// Note: username, email, phone are stored in service DB, not locally
	// For local DB, we provide placeholder values to satisfy NOT NULL constraints
	// The migration 004 should make these nullable, but SQLite doesn't support ALTER COLUMN
	// So we provide placeholders until the schema is properly migrated
	placeholderUsername := user.ID // Use user ID as placeholder username
	placeholderEmail := ""
	placeholderPhone := ""
	
	query := `
		INSERT INTO users (id, clerk_id, username, email, phone, identity_key_public, identity_key_private, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	now := utils.GetCurrentTimestamp()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := s.db.Exec(query, user.ID, user.ClerkID, placeholderUsername, placeholderEmail, placeholderPhone,
		user.IdentityKeyPublic, user.IdentityKeyPrivate, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(id string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, clerk_id, identity_key_public, identity_key_private, created_at, updated_at
		FROM users
		WHERE id = ?
	`

	err := s.db.QueryRow(query, id).Scan(
		&user.ID, &user.ClerkID,
		&user.IdentityKeyPublic, &user.IdentityKeyPrivate,
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

// GetUserByClerkID retrieves a user by Clerk ID
func (s *UserService) GetUserByClerkID(clerkID string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, clerk_id, identity_key_public, identity_key_private, created_at, updated_at
		FROM users
		WHERE clerk_id = ?
		LIMIT 1
	`

	err := s.db.QueryRow(query, clerkID).Scan(
		&user.ID, &user.ClerkID,
		&user.IdentityKeyPublic, &user.IdentityKeyPrivate,
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
// Note: Only identity keys can be updated locally (username/email/phone are in service DB)
func (s *UserService) UpdateUser(user *models.User) error {
	user.UpdatedAt = utils.GetCurrentTimestamp()

	query := `
		UPDATE users
		SET identity_key_public = ?, identity_key_private = ?, updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query,
		user.IdentityKeyPublic, user.IdentityKeyPrivate, user.UpdatedAt, user.ID)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// ListUsers lists all users (for admin/debugging purposes)
func (s *UserService) ListUsers() ([]*models.User, error) {
	query := `
		SELECT id, clerk_id, identity_key_public, identity_key_private, created_at, updated_at
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
			&user.IdentityKeyPublic, &user.IdentityKeyPrivate,
			&user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	return users, rows.Err()
}
