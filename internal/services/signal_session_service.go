package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// SignalSessionService handles Signal protocol session operations
type SignalSessionService struct {
	db *sql.DB
}

// NewSignalSessionService creates a new Signal session service
func NewSignalSessionService(db *sql.DB) *SignalSessionService {
	return &SignalSessionService{db: db}
}

// CreateOrUpdateSession creates or updates a Signal session
func (s *SignalSessionService) CreateOrUpdateSession(session *models.SignalSession) error {
	if session.ID == "" {
		session.ID = utils.NewULID()
	}

	now := utils.GetCurrentTimestamp()
	if session.CreatedAt == 0 {
		session.CreatedAt = now
	}
	session.UpdatedAt = now

	query := `
		INSERT INTO signal_sessions (id, local_user_id, remote_user_identifier, session_data, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(local_user_id, remote_user_identifier) DO UPDATE SET
			session_data = excluded.session_data,
			updated_at = excluded.updated_at
	`

	_, err := s.db.Exec(query, session.ID, session.LocalUserID, session.RemoteUserIdentifier,
		session.SessionData, session.CreatedAt, session.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create/update session: %w", err)
	}

	return nil
}

// GetSession retrieves a Signal session
func (s *SignalSessionService) GetSession(localUserID, remoteUserIdentifier string) (*models.SignalSession, error) {
	session := &models.SignalSession{}
	query := `
		SELECT id, local_user_id, remote_user_identifier, session_data, created_at, updated_at
		FROM signal_sessions
		WHERE local_user_id = ? AND remote_user_identifier = ?
	`

	err := s.db.QueryRow(query, localUserID, remoteUserIdentifier).Scan(
		&session.ID, &session.LocalUserID, &session.RemoteUserIdentifier,
		&session.SessionData, &session.CreatedAt, &session.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return session, nil
}

// ListUserSessions lists all sessions for a local user
func (s *SignalSessionService) ListUserSessions(localUserID string) ([]*models.SignalSession, error) {
	query := `
		SELECT id, local_user_id, remote_user_identifier, session_data, created_at, updated_at
		FROM signal_sessions
		WHERE local_user_id = ?
		ORDER BY updated_at DESC
	`

	rows, err := s.db.Query(query, localUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to list sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*models.SignalSession
	for rows.Next() {
		session := &models.SignalSession{}
		err := rows.Scan(
			&session.ID, &session.LocalUserID, &session.RemoteUserIdentifier,
			&session.SessionData, &session.CreatedAt, &session.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}
		sessions = append(sessions, session)
	}

	return sessions, rows.Err()
}

// DeleteSession deletes a Signal session
func (s *SignalSessionService) DeleteSession(localUserID, remoteUserIdentifier string) error {
	query := `
		DELETE FROM signal_sessions
		WHERE local_user_id = ? AND remote_user_identifier = ?
	`

	_, err := s.db.Exec(query, localUserID, remoteUserIdentifier)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}

