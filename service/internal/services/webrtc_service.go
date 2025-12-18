package services

import (
	"database/sql"
	"fmt"
	"time"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

type WebRTCService struct {
	db          *database.DB
	authService *AuthService
}

func NewWebRTCService(db *database.DB) *WebRTCService {
	return &WebRTCService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// SendWebRTCSignal stores a WebRTC signaling message
func (s *WebRTCService) SendWebRTCSignal(fromUserID, toUserID, signalType, signalData string, expiresInSeconds int64) (string, error) {
	// Validate inputs
	if err := utils.ValidateUserID(fromUserID); err != nil {
		return "", err
	}
	if err := utils.ValidateUserID(toUserID); err != nil {
		return "", err
	}
	if signalType == "" {
		return "", fmt.Errorf("signal type cannot be empty")
	}
	if signalData == "" {
		return "", fmt.Errorf("signal data cannot be empty")
	}

	// Verify both users exist
	fromUserExists, err := s.authService.UserExists(fromUserID)
	if err != nil {
		return "", err
	}
	if !fromUserExists {
		return "", fmt.Errorf("sender user does not exist")
	}

	toUserExists, err := s.authService.UserExists(toUserID)
	if err != nil {
		return "", err
	}
	if !toUserExists {
		return "", fmt.Errorf("recipient user does not exist")
	}

	signalID := utils.NewULID()
	now := utils.GetCurrentTimestamp()

	var expiresAt *int64
	if expiresInSeconds > 0 {
		exp := now + expiresInSeconds
		expiresAt = &exp
	}

	_, err = s.db.GetConn().Exec(`
		INSERT INTO webrtc_signaling (id, from_user_id, to_user_id, signal_type, signal_data, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, signalID, fromUserID, toUserID, signalType, signalData, now, expiresAt)
	if err != nil {
		return "", fmt.Errorf("failed to send WebRTC signal: %w", err)
	}

	return signalID, nil
}

// GetWebRTCSignals retrieves all WebRTC signals for a user
func (s *WebRTCService) GetWebRTCSignals(userID string) ([]*models.WebRTCSignal, error) {
	// Validate inputs
	if err := utils.ValidateUserID(userID); err != nil {
		return nil, err
	}

	now := utils.GetCurrentTimestamp()

	rows, err := s.db.GetConn().Query(`
		SELECT id, from_user_id, signal_type, signal_data, created_at, expires_at
		FROM webrtc_signaling
		WHERE to_user_id = ? 
		  AND (expires_at IS NULL OR expires_at > ?)
		ORDER BY created_at ASC
	`, userID, now)
	if err != nil {
		return nil, fmt.Errorf("failed to get WebRTC signals: %w", err)
	}
	defer rows.Close()

	var signals []*models.WebRTCSignal
	for rows.Next() {
		signal := &models.WebRTCSignal{
			ToUserID: userID,
		}
		var expiresAt sql.NullInt64

		err := rows.Scan(
			&signal.ID,
			&signal.FromUserID,
			&signal.SignalType,
			&signal.SignalData,
			&signal.CreatedAt,
			&expiresAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan WebRTC signal: %w", err)
		}

		if expiresAt.Valid {
			signal.ExpiresAt = &expiresAt.Int64
		}

		signals = append(signals, signal)
	}

	return signals, rows.Err()
}

// CleanupExpiredSignals removes expired WebRTC signals
func (s *WebRTCService) CleanupExpiredSignals() error {
	now := utils.GetCurrentTimestamp()
	_, err := s.db.GetConn().Exec(`
		DELETE FROM webrtc_signaling
		WHERE expires_at IS NOT NULL AND expires_at <= ?
	`, now)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired signals: %w", err)
	}
	return nil
}

// StartCleanupRoutine starts a background routine to clean up expired signals
func (s *WebRTCService) StartCleanupRoutine(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			if err := s.CleanupExpiredSignals(); err != nil {
				// Log error (in production, use proper logging)
				fmt.Printf("Error cleaning up expired WebRTC signals: %v\n", err)
			}
		}
	}()
}
