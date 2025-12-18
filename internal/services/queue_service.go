package services

import (
	"database/sql"
	"fmt"
	"math"
	"pollis/internal/models"
	"pollis/internal/utils"
	"time"
)

// QueueService handles message queue operations for offline messages
type QueueService struct {
	db *sql.DB
}

// NewQueueService creates a new queue service
func NewQueueService(db *sql.DB) *QueueService {
	return &QueueService{db: db}
}

// AddToQueue adds a message to the queue
func (s *QueueService) AddToQueue(messageID string) error {
	queueItem := &models.MessageQueue{
		ID:         utils.NewULID(),
		MessageID:  messageID,
		Status:     "pending",
		RetryCount: 0,
		CreatedAt:  utils.GetCurrentTimestamp(),
		UpdatedAt:  utils.GetCurrentTimestamp(),
	}

	query := `
		INSERT INTO message_queue (id, message_id, status, retry_count, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, queueItem.ID, queueItem.MessageID, queueItem.Status,
		queueItem.RetryCount, queueItem.CreatedAt, queueItem.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to add message to queue: %w", err)
	}

	return nil
}

// GetPendingMessages returns all pending messages from the queue
func (s *QueueService) GetPendingMessages() ([]*models.MessageQueue, error) {
	query := `
		SELECT id, message_id, status, retry_count, created_at, updated_at
		FROM message_queue
		WHERE status = 'pending'
		ORDER BY created_at ASC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending messages: %w", err)
	}
	defer rows.Close()

	var queueItems []*models.MessageQueue
	for rows.Next() {
		item := &models.MessageQueue{}
		err := rows.Scan(
			&item.ID, &item.MessageID, &item.Status, &item.RetryCount,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan queue item: %w", err)
		}
		queueItems = append(queueItems, item)
	}

	return queueItems, rows.Err()
}

// GetQueueItemByMessageID retrieves a queue item by message ID
func (s *QueueService) GetQueueItemByMessageID(messageID string) (*models.MessageQueue, error) {
	item := &models.MessageQueue{}
	query := `
		SELECT id, message_id, status, retry_count, created_at, updated_at
		FROM message_queue
		WHERE message_id = ?
	`

	err := s.db.QueryRow(query, messageID).Scan(
		&item.ID, &item.MessageID, &item.Status, &item.RetryCount,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("queue item not found")
		}
		return nil, fmt.Errorf("failed to get queue item: %w", err)
	}

	return item, nil
}

// UpdateStatus updates the status of a queue item
func (s *QueueService) UpdateStatus(queueID, status string) error {
	query := `
		UPDATE message_queue
		SET status = ?, updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, status, utils.GetCurrentTimestamp(), queueID)
	if err != nil {
		return fmt.Errorf("failed to update queue status: %w", err)
	}

	return nil
}

// IncrementRetry increments the retry count for a queue item
func (s *QueueService) IncrementRetry(queueID string) error {
	query := `
		UPDATE message_queue
		SET retry_count = retry_count + 1, updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, utils.GetCurrentTimestamp(), queueID)
	if err != nil {
		return fmt.Errorf("failed to increment retry count: %w", err)
	}

	return nil
}

// CancelMessage cancels a queued message
func (s *QueueService) CancelMessage(messageID string) error {
	query := `
		UPDATE message_queue
		SET status = 'cancelled', updated_at = ?
		WHERE message_id = ? AND status = 'pending'
	`

	result, err := s.db.Exec(query, utils.GetCurrentTimestamp(), messageID)
	if err != nil {
		return fmt.Errorf("failed to cancel message: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("message not found or not in pending status")
	}

	return nil
}

// RemoveFromQueue removes a message from the queue (after successful send)
func (s *QueueService) RemoveFromQueue(queueID string) error {
	query := `DELETE FROM message_queue WHERE id = ?`

	_, err := s.db.Exec(query, queueID)
	if err != nil {
		return fmt.Errorf("failed to remove from queue: %w", err)
	}

	return nil
}

// CalculateBackoff calculates exponential backoff delay based on retry count
func (s *QueueService) CalculateBackoff(retryCount int) time.Duration {
	// Exponential backoff: 2^retryCount seconds, max 300 seconds (5 minutes)
	delaySeconds := math.Pow(2, float64(retryCount))
	if delaySeconds > 300 {
		delaySeconds = 300
	}
	return time.Duration(delaySeconds) * time.Second
}

// ShouldRetry determines if a message should be retried based on retry count
func (s *QueueService) ShouldRetry(retryCount int) bool {
	// Max 10 retries
	return retryCount < 10
}

