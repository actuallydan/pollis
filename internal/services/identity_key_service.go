package services

import (
	"database/sql"
	"fmt"
	"time"

	"pollis/internal/models"
)

// IdentityKeyService manages local identity keys (long-term identity)
type IdentityKeyService struct {
	db *sql.DB
}

// NewIdentityKeyService creates a new IdentityKeyService
func NewIdentityKeyService(db *sql.DB) *IdentityKeyService {
	return &IdentityKeyService{db: db}
}

// CreateIdentityKey stores a new identity key pair (encrypted)
func (s *IdentityKeyService) CreateIdentityKey(publicKey, privateKeyEncrypted []byte) (*models.IdentityKey, error) {
	key := &models.IdentityKey{
		PublicKey:          publicKey,
		PrivateKeyEncrypted: privateKeyEncrypted,
		CreatedAt:          time.Now().Unix(),
	}

	query := `
		INSERT INTO identity_key (public_key, private_key_encrypted, created_at)
		VALUES (?, ?, ?)
	`

	result, err := s.db.Exec(query, key.PublicKey, key.PrivateKeyEncrypted, key.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create identity key: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get identity key ID: %w", err)
	}

	key.ID = int(id)
	return key, nil
}

// GetIdentityKey retrieves the current identity key (most recent)
func (s *IdentityKeyService) GetIdentityKey() (*models.IdentityKey, error) {
	query := `
		SELECT id, public_key, private_key_encrypted, created_at
		FROM identity_key
		ORDER BY created_at DESC
		LIMIT 1
	`

	key := &models.IdentityKey{}
	err := s.db.QueryRow(query).Scan(
		&key.ID,
		&key.PublicKey,
		&key.PrivateKeyEncrypted,
		&key.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get identity key: %w", err)
	}

	return key, nil
}

// GetIdentityKeyByID retrieves a specific identity key by ID
func (s *IdentityKeyService) GetIdentityKeyByID(id int) (*models.IdentityKey, error) {
	query := `
		SELECT id, public_key, private_key_encrypted, created_at
		FROM identity_key
		WHERE id = ?
	`

	key := &models.IdentityKey{}
	err := s.db.QueryRow(query, id).Scan(
		&key.ID,
		&key.PublicKey,
		&key.PrivateKeyEncrypted,
		&key.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get identity key: %w", err)
	}

	return key, nil
}

// HasIdentityKey checks if an identity key exists
func (s *IdentityKeyService) HasIdentityKey() (bool, error) {
	query := `SELECT COUNT(*) FROM identity_key`
	var count int
	err := s.db.QueryRow(query).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check identity key: %w", err)
	}
	return count > 0, nil
}

// DeleteIdentityKey removes an identity key (use with caution - breaks existing sessions)
func (s *IdentityKeyService) DeleteIdentityKey(id int) error {
	query := `DELETE FROM identity_key WHERE id = ?`
	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete identity key: %w", err)
	}
	return nil
}

// DeleteAllIdentityKeys removes all identity keys (use with extreme caution)
func (s *IdentityKeyService) DeleteAllIdentityKeys() error {
	query := `DELETE FROM identity_key`
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to delete all identity keys: %w", err)
	}
	return nil
}
