package services

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/ably/ably-go/ably"
)

// AblyRealtimeService handles Ably real-time messaging
type AblyRealtimeService struct {
	client *ably.Realtime
	ctx    context.Context
	cancel context.CancelFunc

	// Track active subscriptions to prevent duplicates
	subscribedChannels map[string]bool
	subMutex           sync.RWMutex
}

// NewAblyRealtimeService creates a new Ably realtime service
func NewAblyRealtimeService(apiKey string) (*AblyRealtimeService, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("Ably API key is required")
	}

	client, err := ably.NewRealtime(
		ably.WithKey(apiKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create Ably client: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &AblyRealtimeService{
		client:             client,
		ctx:                ctx,
		cancel:             cancel,
		subscribedChannels: make(map[string]bool),
	}, nil
}

// SubscribeToChannel subscribes to a channel and forwards messages via callback.
// This method is idempotent - calling it multiple times for the same channel
// will not create duplicate subscriptions.
func (s *AblyRealtimeService) SubscribeToChannel(channelID string, onMessage func(map[string]interface{})) error {
	s.subMutex.Lock()
	defer s.subMutex.Unlock()

	// Check if already subscribed - prevent duplicate subscriptions
	if s.subscribedChannels[channelID] {
		fmt.Printf("[Ably] Already subscribed to channel: %s\n", channelID)
		return nil
	}

	channelName := fmt.Sprintf("channel:%s", channelID)
	channel := s.client.Channels.Get(channelName)

	fmt.Printf("[Ably] Subscribing to channel: %s\n", channelName)

	_, err := channel.SubscribeAll(s.ctx, func(msg *ably.Message) {
		fmt.Printf("[Ably] Received message on %s: name=%s, data=%v (type: %T)\n", channelName, msg.Name, msg.Data, msg.Data)
		
		// Filter for "message" events only
		if msg.Name != "message" {
			fmt.Printf("[Ably] Ignoring non-message event: %s\n", msg.Name)
			return
		}

		data := make(map[string]interface{})
		if msg.Data != nil {
			switch v := msg.Data.(type) {
			case map[string]interface{}:
				data = v
			case string:
				// Ably may return data as a JSON string - parse it
				if err := json.Unmarshal([]byte(v), &data); err != nil {
					fmt.Printf("[Ably] Failed to parse message data as JSON: %v\n", err)
					return
				}
			default:
				fmt.Printf("[Ably] Unexpected data type: %T\n", msg.Data)
				return
			}
		}
		fmt.Printf("[Ably] Forwarding message to frontend: %v\n", data)
		onMessage(data)
	})

	if err != nil {
		return fmt.Errorf("failed to subscribe to channel %s: %w", channelName, err)
	}

	// Mark as subscribed
	s.subscribedChannels[channelID] = true
	fmt.Printf("[Ably] Successfully subscribed to channel: %s\n", channelName)
	return nil
}

// UnsubscribeFromChannel unsubscribes from a channel.
// This method is idempotent - calling it for a channel that isn't subscribed
// will return nil.
func (s *AblyRealtimeService) UnsubscribeFromChannel(channelID string) error {
	s.subMutex.Lock()
	defer s.subMutex.Unlock()

	// Check if subscribed
	if !s.subscribedChannels[channelID] {
		// Not subscribed, return nil (idempotent)
		return nil
	}

	channelName := fmt.Sprintf("channel:%s", channelID)
	channel := s.client.Channels.Get(channelName)

	// Detach channel (removes all subscriptions for this channel)
	err := channel.Detach(s.ctx)
	if err != nil {
		return fmt.Errorf("failed to unsubscribe from channel %s: %w", channelID, err)
	}

	// Remove from tracking
	delete(s.subscribedChannels, channelID)
	return nil
}

// PublishMessage publishes a message to Ably channel
func (s *AblyRealtimeService) PublishMessage(channelID string, messageData map[string]interface{}) error {
	channelName := fmt.Sprintf("channel:%s", channelID)
	channel := s.client.Channels.Get(channelName)

	fmt.Printf("[Ably] Publishing message to %s: %v\n", channelName, messageData)

	err := channel.Publish(s.ctx, "message", messageData)
	if err != nil {
		return fmt.Errorf("failed to publish message to channel %s: %w", channelName, err)
	}

	fmt.Printf("[Ably] Successfully published message to %s\n", channelName)
	return nil
}

// IsSubscribed checks if currently subscribed to a channel
func (s *AblyRealtimeService) IsSubscribed(channelID string) bool {
	s.subMutex.RLock()
	defer s.subMutex.RUnlock()
	return s.subscribedChannels[channelID]
}

// GetSubscribedChannels returns a list of all currently subscribed channel IDs
func (s *AblyRealtimeService) GetSubscribedChannels() []string {
	s.subMutex.RLock()
	defer s.subMutex.RUnlock()

	channels := make([]string, 0, len(s.subscribedChannels))
	for channelID := range s.subscribedChannels {
		channels = append(channels, channelID)
	}
	return channels
}

// Close closes the Ably connection and cleans up all subscriptions
func (s *AblyRealtimeService) Close() error {
	s.subMutex.Lock()
	defer s.subMutex.Unlock()

	// Detach from all subscribed channels
	for channelID := range s.subscribedChannels {
		channelName := fmt.Sprintf("channel:%s", channelID)
		channel := s.client.Channels.Get(channelName)
		// Best effort - ignore errors during cleanup
		_ = channel.Detach(s.ctx)
	}

	// Clear tracking map
	s.subscribedChannels = make(map[string]bool)

	s.cancel()
	s.client.Close()
	return nil
}
