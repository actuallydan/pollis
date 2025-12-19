package services

import (
	"context"
	"fmt"
	"pollis/internal/models"
	"sync"
	"time"
)

// QueueProcessor handles processing of queued messages
type QueueProcessor struct {
	queueService    *QueueService
	messageService  *MessageService
	serviceClient   *ServiceClient
	networkService  *NetworkService
	signalService   *SignalService
	mu              sync.Mutex
	isProcessing    bool
	stopChan        chan struct{}
	ctx             context.Context
	cancel          context.CancelFunc
}

// NewQueueProcessor creates a new queue processor
func NewQueueProcessor(
	queueService *QueueService,
	messageService *MessageService,
	serviceClient *ServiceClient,
	networkService *NetworkService,
	signalService *SignalService,
) *QueueProcessor {
	ctx, cancel := context.WithCancel(context.Background())
	return &QueueProcessor{
		queueService:   queueService,
		messageService: messageService,
		serviceClient:  serviceClient,
		networkService: networkService,
		signalService:  signalService,
		stopChan:       make(chan struct{}),
		ctx:            ctx,
		cancel:         cancel,
	}
}

// Start starts the queue processor
func (p *QueueProcessor) Start() {
	go p.processLoop()
}

// Stop stops the queue processor
func (p *QueueProcessor) Stop() {
	p.cancel()
	close(p.stopChan)
}

// ProcessQueue processes all pending messages in the queue
func (p *QueueProcessor) ProcessQueue() error {
	p.mu.Lock()
	if p.isProcessing {
		p.mu.Unlock()
		return fmt.Errorf("queue processing already in progress")
	}
	p.isProcessing = true
	p.mu.Unlock()

	defer func() {
		p.mu.Lock()
		p.isProcessing = false
		p.mu.Unlock()
	}()

	// Check if online
	if !p.networkService.IsOnline() {
		return fmt.Errorf("network not available")
	}

	// Get pending messages
	pending, err := p.queueService.GetPendingMessages()
	if err != nil {
		return fmt.Errorf("failed to get pending messages: %w", err)
	}

	// Process each message
	for _, item := range pending {
		if err := p.processMessage(item); err != nil {
			// Log error but continue processing other messages
			fmt.Printf("Error processing message %s: %v\n", item.MessageID, err)
		}
	}

	return nil
}

// processMessage processes a single queued message
func (p *QueueProcessor) processMessage(item *models.MessageQueue) error {
	// Check retry limit
	if !p.queueService.ShouldRetry(item.RetryCount) {
		// Mark as failed permanently
		return p.queueService.UpdateStatus(item.ID, "failed")
	}

	// Update status to sending
	if err := p.queueService.UpdateStatus(item.ID, "sending"); err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	// Get the message
	message, err := p.messageService.GetMessageByID(item.MessageID)
	if err != nil {
		// If message not found, mark as failed and remove from queue
		_ = p.queueService.UpdateStatus(item.ID, "failed")
		_ = p.queueService.RemoveFromQueue(item.ID)
		return fmt.Errorf("failed to get message: %w", err)
	}

	// Calculate backoff if retrying
	if item.RetryCount > 0 {
		backoff := p.queueService.CalculateBackoff(item.RetryCount)
		time.Sleep(backoff)
	}

	// Send message via service client
	// Note: In production, this would send the encrypted message to the service
	// For now, we'll simulate success
	err = p.sendMessage(message)
	if err != nil {
		// Increment retry count
		if retryErr := p.queueService.IncrementRetry(item.ID); retryErr != nil {
			return fmt.Errorf("failed to increment retry: %w", retryErr)
		}

		// Check if should retry
		if p.queueService.ShouldRetry(item.RetryCount + 1) {
			// Reset to pending for retry
			return p.queueService.UpdateStatus(item.ID, "pending")
		} else {
			// Mark as failed
			return p.queueService.UpdateStatus(item.ID, "failed")
		}
	}

	// Success - remove from queue
	if err := p.queueService.RemoveFromQueue(item.ID); err != nil {
		return fmt.Errorf("failed to remove from queue: %w", err)
	}

	return nil
}

// sendMessage sends a message via the service client
func (p *QueueProcessor) sendMessage(message *models.Message) error {
	// In production, this would:
	// 1. Get recipients (group members or DM recipient)
	// 2. Encrypt message for each recipient using Signal protocol
	// 3. Send encrypted messages to service
	// For now, this is a placeholder

	// Simulate network delay
	time.Sleep(100 * time.Millisecond)

	// In production, implement actual sending logic here
	return nil
}

// processLoop continuously processes the queue when online
func (p *QueueProcessor) processLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-p.stopChan:
			return
		case <-ticker.C:
			// Only process if online
			if p.networkService.IsOnline() {
				_ = p.ProcessQueue()
			}
		}
	}
}

// TriggerProcessing manually triggers queue processing
func (p *QueueProcessor) TriggerProcessing() error {
	return p.ProcessQueue()
}

