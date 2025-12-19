package services

import (
	"crypto/ed25519"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

const (
	preKeyDailyLimit = 100
)

// PreKeyService manages identity/signed-pre-key/OTPK bundles
type PreKeyService struct {
	db          *database.DB
	authService *AuthService
}

func NewPreKeyService(db *database.DB) *PreKeyService {
	return &PreKeyService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// RegisterPreKeys stores identity key, signed pre-key (with signature), and OTPKs for a user
func (s *PreKeyService) RegisterPreKeys(userID string, identityKey, signedPreKey, signedPreKeySig []byte, otpks [][]byte) error {
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}
	if len(identityKey) != ed25519.PublicKeySize {
		return fmt.Errorf("identity key must be %d bytes", ed25519.PublicKeySize)
	}
	if len(signedPreKey) == 0 || len(signedPreKeySig) == 0 {
		return fmt.Errorf("signed pre-key and signature are required")
	}
	// Verify signature: sig over signedPreKey using identityKey (Ed25519)
	if !ed25519.Verify(ed25519.PublicKey(identityKey), signedPreKey, signedPreKeySig) {
		return fmt.Errorf("invalid signed pre-key signature")
	}

	// Ensure user exists
	exists, err := s.authService.UserExists(userID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("user not found")
	}

	now := utils.GetCurrentTimestamp()

	tx, err := s.db.GetConn().Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Upsert prekey bundle
	_, err = tx.Exec(`
		INSERT INTO prekey_bundles (user_id, identity_key, signed_pre_key, signed_pre_key_sig, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			identity_key = excluded.identity_key,
			signed_pre_key = excluded.signed_pre_key,
			signed_pre_key_sig = excluded.signed_pre_key_sig,
			updated_at = excluded.updated_at
	`, userID, identityKey, signedPreKey, signedPreKeySig, now, now)
	if err != nil {
		return fmt.Errorf("failed to upsert prekey bundle: %w", err)
	}

	// Replace OTPKs: delete existing, insert new
	_, err = tx.Exec(`DELETE FROM one_time_prekeys WHERE user_id = ?`, userID)
	if err != nil {
		return fmt.Errorf("failed to clear existing one-time pre-keys: %w", err)
	}

	for _, otpk := range otpks {
		if len(otpk) == 0 {
			continue
		}
		id := utils.NewULID()
		_, err = tx.Exec(`
			INSERT INTO one_time_prekeys (id, user_id, pre_key, consumed, created_at)
			VALUES (?, ?, ?, 0, ?)
		`, id, userID, otpk, now)
		if err != nil {
			return fmt.Errorf("failed to insert one-time pre-key: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit prekey registration: %w", err)
	}

	return nil
}

// GetPreKeyBundle returns the current bundle and consumes a single OTPK (if available)
func (s *PreKeyService) GetPreKeyBundle(userIdentifier string) (*models.PreKeyBundle, []byte, error) {
	if err := utils.ValidateUserIdentifier(userIdentifier); err != nil {
		return nil, nil, err
	}

	userID, err := s.resolveUserID(userIdentifier)
	if err != nil {
		return nil, nil, err
	}

	// Rate limiting: 100/day per user
	if err := s.incrementPreKeyRequestCount(userID); err != nil {
		return nil, nil, err
	}

	tx, err := s.db.GetConn().Begin()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var bundle models.PreKeyBundle
	err = tx.QueryRow(`
		SELECT user_id, identity_key, signed_pre_key, signed_pre_key_sig, created_at, updated_at
		FROM prekey_bundles
		WHERE user_id = ?
	`, userID).Scan(
		&bundle.UserID,
		&bundle.IdentityKey,
		&bundle.SignedPreKey,
		&bundle.SignedPreKeySig,
		&bundle.CreatedAt,
		&bundle.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, fmt.Errorf("pre-key bundle not found")
		}
		return nil, nil, fmt.Errorf("failed to fetch pre-key bundle: %w", err)
	}

	// Consume one OTPK if available
	var otpkID string
	var otpk []byte
	err = tx.QueryRow(`
		SELECT id, pre_key FROM one_time_prekeys
		WHERE user_id = ? AND consumed = 0
		ORDER BY created_at ASC
		LIMIT 1
	`, userID).Scan(&otpkID, &otpk)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, nil, fmt.Errorf("failed to fetch one-time pre-key: %w", err)
	}

	if otpkID != "" {
		now := utils.GetCurrentTimestamp()
		_, err = tx.Exec(`
			UPDATE one_time_prekeys
			SET consumed = 1, consumed_at = ?
			WHERE id = ?
		`, now, otpkID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to mark one-time pre-key consumed: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, fmt.Errorf("failed to commit pre-key bundle retrieval: %w", err)
	}

	return &bundle, otpk, nil
}

// RotateSignedPreKey updates the signed pre-key (signature is validated against stored identity key)
func (s *PreKeyService) RotateSignedPreKey(userID string, signedPreKey, signedPreKeySig []byte) error {
	if err := utils.ValidateUserID(userID); err != nil {
		return err
	}
	if len(signedPreKey) == 0 || len(signedPreKeySig) == 0 {
		return fmt.Errorf("signed pre-key and signature are required")
	}

	// Fetch identity key to validate signature
	var identityKey []byte
	err := s.db.GetConn().QueryRow(`
		SELECT identity_key FROM prekey_bundles WHERE user_id = ?
	`, userID).Scan(&identityKey)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("pre-key bundle not found")
		}
		return fmt.Errorf("failed to load identity key: %w", err)
	}

	if len(identityKey) != ed25519.PublicKeySize {
		return fmt.Errorf("stored identity key invalid size")
	}

	if !ed25519.Verify(ed25519.PublicKey(identityKey), signedPreKey, signedPreKeySig) {
		return fmt.Errorf("invalid signed pre-key signature")
	}

	now := utils.GetCurrentTimestamp()
	_, err = s.db.GetConn().Exec(`
		UPDATE prekey_bundles
		SET signed_pre_key = ?, signed_pre_key_sig = ?, updated_at = ?
		WHERE user_id = ?
	`, signedPreKey, signedPreKeySig, now, userID)
	if err != nil {
		return fmt.Errorf("failed to rotate signed pre-key: %w", err)
	}

	return nil
}

// incrementPreKeyRequestCount enforces per-user daily limit
func (s *PreKeyService) incrementPreKeyRequestCount(userID string) error {
	day := currentDayInt()
	// Upsert count
	_, err := s.db.GetConn().Exec(`
		INSERT INTO prekey_bundle_requests (user_id, day, count)
		VALUES (?, ?, 1)
		ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
	`, userID, day)
	if err != nil {
		return fmt.Errorf("failed to record pre-key bundle request: %w", err)
	}

	var count int
	err = s.db.GetConn().QueryRow(`
		SELECT count FROM prekey_bundle_requests WHERE user_id = ? AND day = ?
	`, userID, day).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to read pre-key request count: %w", err)
	}

	if count > preKeyDailyLimit {
		return fmt.Errorf("pre-key bundle request limit exceeded")
	}
	return nil
}

func currentDayInt() int {
	now := time.Now().UTC()
	y, m, d := now.Date()
	return y*10000 + int(m)*100 + d
}

// resolveUserID looks up the user ID from identifier
func (s *PreKeyService) resolveUserID(userIdentifier string) (string, error) {
	var userID string
	err := s.db.GetConn().QueryRow(`
		SELECT id FROM users
		WHERE username = ? OR email = ? OR phone = ?
		LIMIT 1
	`, userIdentifier, userIdentifier, userIdentifier).Scan(&userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("user not found")
		}
		return "", fmt.Errorf("failed to resolve user ID: %w", err)
	}
	return userID, nil
}
