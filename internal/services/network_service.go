package services

import (
	"context"
	"net"
	"sync"
	"time"
)

// NetworkService manages network status and kill-switch
type NetworkService struct {
	mu            sync.RWMutex
	killSwitch    bool
	isOnline      bool
	checkURL      string
	checkInterval time.Duration
	stopChan      chan struct{}
	ctx           context.Context
	cancel        context.CancelFunc
	isMonitoring  bool // Track if monitoring is already running
}

// NewNetworkService creates a new network service
func NewNetworkService() *NetworkService {
	ctx, cancel := context.WithCancel(context.Background())
	return &NetworkService{
		isOnline:      true, // Assume online by default
		checkURL:       "8.8.8.8:53", // Google DNS for connectivity check
		checkInterval: 30 * time.Second,
		stopChan:      make(chan struct{}),
		ctx:           ctx,
		cancel:        cancel,
		isMonitoring:  false,
	}
}

// StartMonitoring starts network connectivity monitoring
// This method is idempotent - calling it multiple times will not create duplicate monitors
func (s *NetworkService) StartMonitoring() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already monitoring to prevent duplicate goroutines
	if s.isMonitoring {
		return
	}

	s.isMonitoring = true
	go s.monitor()
}

// StopMonitoring stops network connectivity monitoring
func (s *NetworkService) StopMonitoring() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isMonitoring {
		return
	}

	s.isMonitoring = false
	s.cancel()

	// Don't close stopChan - it might be closed already
	// Instead, use context cancellation only
}

// monitor periodically checks network connectivity
func (s *NetworkService) monitor() {
	ticker := time.NewTicker(s.checkInterval)
	defer ticker.Stop()

	// Initial check
	s.checkConnectivity()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.checkConnectivity()
		}
	}
}

// checkConnectivity checks if the network is available
func (s *NetworkService) checkConnectivity() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Skip check if kill-switch is enabled
	if s.killSwitch {
		return
	}

	// Try to connect to a reliable host (Google DNS)
	conn, err := net.DialTimeout("tcp", s.checkURL, 5*time.Second)
	if err != nil {
		s.isOnline = false
		return
	}
	conn.Close()
	s.isOnline = true
}

// GetStatus returns the current network status
func (s *NetworkService) GetStatus() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.killSwitch {
		return "kill-switch"
	}
	if s.isOnline {
		return "online"
	}
	return "offline"
}

// SetKillSwitch sets the kill-switch state
func (s *NetworkService) SetKillSwitch(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.killSwitch = enabled
}

// IsOnline checks if the network is available (not offline and not kill-switched)
func (s *NetworkService) IsOnline() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isOnline && !s.killSwitch
}

// SetOnline sets the online status (for network monitoring)
func (s *NetworkService) SetOnline(online bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isOnline = online
}

// SetCheckURL sets the URL to check for connectivity
func (s *NetworkService) SetCheckURL(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.checkURL = url
}

// SetCheckInterval sets the interval for connectivity checks
func (s *NetworkService) SetCheckInterval(interval time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.checkInterval = interval
}
