package services

import (
	"database/sql"
	"fmt"
	"time"

	"pollis/internal/models"
	"github.com/oklog/ulid/v2"
)

// AuthSessionService manages authentication sessions
type AuthSessionService struct {
	db *sql.DB
}

// NewAuthSessionService creates a new AuthSessionService
func NewAuthSessionService(db *sql.DB) *AuthSessionService {
	return &AuthSessionService{db: db}
}

// CreateSession creates a new auth session
func (s *AuthSessionService) CreateSession(clerkUserID, clerkSessionToken, appAuthToken string, expiresAt time.Time) (*models.AuthSession, error) {
	now := time.Now().Unix()

	session := &models.AuthSession{
		ID:               ulid.Make().String(),
		ClerkUserID:      clerkUserID,
		ClerkSessionToken: clerkSessionToken,
		AppAuthToken:     appAuthToken,
		CreatedAt:        now,
		ExpiresAt:        expiresAt.Unix(),
		LastUsedAt:       now,
	}

	query := `
		INSERT INTO auth_session (id, clerk_user_id, clerk_session_token, app_auth_token, created_at, expires_at, last_used_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		session.ID,
		session.ClerkUserID,
		session.ClerkSessionToken,
		session.AppAuthToken,
		session.CreatedAt,
		session.ExpiresAt,
		session.LastUsedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create auth session: %w", err)
	}

	return session, nil
}

// GetSessionByClerkUserID retrieves the most recent session for a clerk user
func (s *AuthSessionService) GetSessionByClerkUserID(clerkUserID string) (*models.AuthSession, error) {
	query := `
		SELECT id, clerk_user_id, clerk_session_token, app_auth_token, created_at, expires_at, last_used_at
		FROM auth_session
		WHERE clerk_user_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`

	session := &models.AuthSession{}
	err := s.db.QueryRow(query, clerkUserID).Scan(
		&session.ID,
		&session.ClerkUserID,
		&session.ClerkSessionToken,
		&session.AppAuthToken,
		&session.CreatedAt,
		&session.ExpiresAt,
		&session.LastUsedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get auth session: %w", err)
	}

	return session, nil
}

// GetSessionByID retrieves a session by its ID
func (s *AuthSessionService) GetSessionByID(id string) (*models.AuthSession, error) {
	query := `
		SELECT id, clerk_user_id, clerk_session_token, app_auth_token, created_at, expires_at, last_used_at
		FROM auth_session
		WHERE id = ?
	`

	session := &models.AuthSession{}
	err := s.db.QueryRow(query, id).Scan(
		&session.ID,
		&session.ClerkUserID,
		&session.ClerkSessionToken,
		&session.AppAuthToken,
		&session.CreatedAt,
		&session.ExpiresAt,
		&session.LastUsedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get auth session: %w", err)
	}

	return session, nil
}

// UpdateLastUsed updates the last_used_at timestamp for a session
func (s *AuthSessionService) UpdateLastUsed(id string) error {
	query := `UPDATE auth_session SET last_used_at = ? WHERE id = ?`
	_, err := s.db.Exec(query, time.Now().Unix(), id)
	if err != nil {
		return fmt.Errorf("failed to update last used: %w", err)
	}
	return nil
}

// UpdateTokens updates the tokens for a session (for token refresh)
func (s *AuthSessionService) UpdateTokens(id, clerkSessionToken, appAuthToken string, expiresAt time.Time) error {
	query := `
		UPDATE auth_session
		SET clerk_session_token = ?, app_auth_token = ?, expires_at = ?, last_used_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, clerkSessionToken, appAuthToken, expiresAt.Unix(), time.Now().Unix(), id)
	if err != nil {
		return fmt.Errorf("failed to update tokens: %w", err)
	}
	return nil
}

// DeleteSession deletes a session (logout)
func (s *AuthSessionService) DeleteSession(id string) error {
	query := `DELETE FROM auth_session WHERE id = ?`
	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

// DeleteSessionsByClerkUserID deletes all sessions for a clerk user
func (s *AuthSessionService) DeleteSessionsByClerkUserID(clerkUserID string) error {
	query := `DELETE FROM auth_session WHERE clerk_user_id = ?`
	_, err := s.db.Exec(query, clerkUserID)
	if err != nil {
		return fmt.Errorf("failed to delete sessions: %w", err)
	}
	return nil
}

// IsExpired checks if a session is expired
func (s *AuthSessionService) IsExpired(session *models.AuthSession) bool {
	return time.Now().Unix() > session.ExpiresAt
}

// CleanupExpiredSessions removes all expired sessions
func (s *AuthSessionService) CleanupExpiredSessions() error {
	query := `DELETE FROM auth_session WHERE expires_at < ?`
	_, err := s.db.Exec(query, time.Now().Unix())
	if err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}
	return nil
}
