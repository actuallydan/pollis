package services

import (
	"database/sql"
	"fmt"
	"time"

	"pollis/internal/models"
)

// PrekeyService manages signed and one-time prekeys locally
type PrekeyService struct {
	db *sql.DB
}

// NewPrekeyService creates a new PrekeyService
func NewPrekeyService(db *sql.DB) *PrekeyService {
	return &PrekeyService{db: db}
}

// ============================================================================
// Signed PreKeys
// ============================================================================

// CreateSignedPreKey stores a new signed prekey
func (s *PrekeyService) CreateSignedPreKey(publicKey, privateKeyEncrypted, signature []byte, expiresAt time.Time) (*models.SignedPreKey, error) {
	key := &models.SignedPreKey{
		PublicKey:          publicKey,
		PrivateKeyEncrypted: privateKeyEncrypted,
		Signature:          signature,
		CreatedAt:          time.Now().Unix(),
		ExpiresAt:          expiresAt.Unix(),
	}

	query := `
		INSERT INTO signed_prekey (public_key, private_key_encrypted, signature, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?)
	`

	result, err := s.db.Exec(query, key.PublicKey, key.PrivateKeyEncrypted, key.Signature, key.CreatedAt, key.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create signed prekey: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get signed prekey ID: %w", err)
	}

	key.ID = int(id)
	return key, nil
}

// GetCurrentSignedPreKey retrieves the most recent non-expired signed prekey
func (s *PrekeyService) GetCurrentSignedPreKey() (*models.SignedPreKey, error) {
	query := `
		SELECT id, public_key, private_key_encrypted, signature, created_at, expires_at
		FROM signed_prekey
		WHERE expires_at > ?
		ORDER BY created_at DESC
		LIMIT 1
	`

	key := &models.SignedPreKey{}
	err := s.db.QueryRow(query, time.Now().Unix()).Scan(
		&key.ID,
		&key.PublicKey,
		&key.PrivateKeyEncrypted,
		&key.Signature,
		&key.CreatedAt,
		&key.ExpiresAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get current signed prekey: %w", err)
	}

	return key, nil
}

// GetSignedPreKeyByID retrieves a specific signed prekey by ID
func (s *PrekeyService) GetSignedPreKeyByID(id int) (*models.SignedPreKey, error) {
	query := `
		SELECT id, public_key, private_key_encrypted, signature, created_at, expires_at
		FROM signed_prekey
		WHERE id = ?
	`

	key := &models.SignedPreKey{}
	err := s.db.QueryRow(query, id).Scan(
		&key.ID,
		&key.PublicKey,
		&key.PrivateKeyEncrypted,
		&key.Signature,
		&key.CreatedAt,
		&key.ExpiresAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get signed prekey: %w", err)
	}

	return key, nil
}

// DeleteExpiredSignedPreKeys removes expired signed prekeys
func (s *PrekeyService) DeleteExpiredSignedPreKeys() error {
	query := `DELETE FROM signed_prekey WHERE expires_at < ?`
	_, err := s.db.Exec(query, time.Now().Unix())
	if err != nil {
		return fmt.Errorf("failed to delete expired signed prekeys: %w", err)
	}
	return nil
}

// ============================================================================
// One-Time PreKeys
// ============================================================================

// CreateOneTimePreKey stores a new one-time prekey
func (s *PrekeyService) CreateOneTimePreKey(publicKey, privateKeyEncrypted []byte) (*models.OneTimePreKey, error) {
	key := &models.OneTimePreKey{
		PublicKey:          publicKey,
		PrivateKeyEncrypted: privateKeyEncrypted,
		Consumed:           false,
		CreatedAt:          time.Now().Unix(),
	}

	query := `
		INSERT INTO one_time_prekey (public_key, private_key_encrypted, consumed, created_at)
		VALUES (?, ?, ?, ?)
	`

	result, err := s.db.Exec(query, key.PublicKey, key.PrivateKeyEncrypted, 0, key.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create one-time prekey: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get one-time prekey ID: %w", err)
	}

	key.ID = int(id)
	return key, nil
}

// CreateOneTimePreKeyBatch stores multiple one-time prekeys at once
func (s *PrekeyService) CreateOneTimePreKeyBatch(keys []struct {
	PublicKey          []byte
	PrivateKeyEncrypted []byte
}) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO one_time_prekey (public_key, private_key_encrypted, consumed, created_at)
		VALUES (?, ?, ?, ?)
	`

	stmt, err := tx.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	now := time.Now().Unix()
	for _, key := range keys {
		_, err := stmt.Exec(key.PublicKey, key.PrivateKeyEncrypted, 0, now)
		if err != nil {
			return fmt.Errorf("failed to insert one-time prekey: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetUnconsumedOneTimePreKey retrieves an unconsumed one-time prekey
func (s *PrekeyService) GetUnconsumedOneTimePreKey() (*models.OneTimePreKey, error) {
	query := `
		SELECT id, public_key, private_key_encrypted, consumed, created_at
		FROM one_time_prekey
		WHERE consumed = 0
		ORDER BY created_at ASC
		LIMIT 1
	`

	key := &models.OneTimePreKey{}
	err := s.db.QueryRow(query).Scan(
		&key.ID,
		&key.PublicKey,
		&key.PrivateKeyEncrypted,
		&key.Consumed,
		&key.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get unconsumed one-time prekey: %w", err)
	}

	return key, nil
}

// GetOneTimePreKeyByID retrieves a specific one-time prekey by ID
func (s *PrekeyService) GetOneTimePreKeyByID(id int) (*models.OneTimePreKey, error) {
	query := `
		SELECT id, public_key, private_key_encrypted, consumed, created_at
		FROM one_time_prekey
		WHERE id = ?
	`

	key := &models.OneTimePreKey{}
	err := s.db.QueryRow(query, id).Scan(
		&key.ID,
		&key.PublicKey,
		&key.PrivateKeyEncrypted,
		&key.Consumed,
		&key.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get one-time prekey: %w", err)
	}

	return key, nil
}

// MarkOneTimePreKeyConsumed marks a one-time prekey as consumed
func (s *PrekeyService) MarkOneTimePreKeyConsumed(id int) error {
	query := `UPDATE one_time_prekey SET consumed = 1 WHERE id = ?`
	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to mark one-time prekey as consumed: %w", err)
	}
	return nil
}

// CountUnconsumedOneTimePreKeys returns the number of unconsumed one-time prekeys
func (s *PrekeyService) CountUnconsumedOneTimePreKeys() (int, error) {
	query := `SELECT COUNT(*) FROM one_time_prekey WHERE consumed = 0`
	var count int
	err := s.db.QueryRow(query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count unconsumed one-time prekeys: %w", err)
	}
	return count, nil
}

// DeleteConsumedOneTimePreKeys removes consumed one-time prekeys
func (s *PrekeyService) DeleteConsumedOneTimePreKeys() error {
	query := `DELETE FROM one_time_prekey WHERE consumed = 1`
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to delete consumed one-time prekeys: %w", err)
	}
	return nil
}

// DeleteAllOneTimePreKeys removes all one-time prekeys (use with caution)
func (s *PrekeyService) DeleteAllOneTimePreKeys() error {
	query := `DELETE FROM one_time_prekey`
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to delete all one-time prekeys: %w", err)
	}
	return nil
}
