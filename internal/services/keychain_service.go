package services

import (
	"fmt"
	"os"
	"strings"

	"github.com/99designs/keyring"
	"github.com/denisbrodbeck/machineid"
)

type KeychainService struct {
	ring keyring.Keyring
}

// getMachineKey returns a machine-specific encryption key
func getMachineKey() (string, error) {
	// ProtectedID generates a hashed version unique to this machine and app
	id, err := machineid.ProtectedID("pollis")
	if err != nil {
		return "", fmt.Errorf("failed to get machine ID: %w", err)
	}
	return id, nil
}

// ensureKeychainDir ensures the keychain directory exists with proper permissions
func ensureKeychainDir(dir string) error {
	expandedDir := os.ExpandEnv(dir)
	if err := os.MkdirAll(expandedDir, 0700); err != nil {
		return fmt.Errorf("failed to create keychain directory: %w", err)
	}
	return nil
}

func NewKeychainService() (*KeychainService, error) {
	keychainDir := "~/.local/share/pollis"

	// Ensure directory exists with correct permissions (owner read/write/execute only)
	if err := ensureKeychainDir(keychainDir); err != nil {
		return nil, err
	}

	// Expand home directory for file backend
	expandedDir := os.ExpandEnv(keychainDir)

	ring, err := keyring.Open(keyring.Config{
		ServiceName: "pollis",
		AllowedBackends: []keyring.BackendType{
			keyring.FileBackend,
		},
		FileDir: expandedDir,
		FilePasswordFunc: func(prompt string) (string, error) {
			return getMachineKey()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open keychain: %w", err)
	}

	return &KeychainService{ring: ring}, nil
}

// StoreEncryptionKey stores the encryption key for a profile
func (ks *KeychainService) StoreEncryptionKey(profileID string, key []byte) error {
	item := keyring.Item{
		Key:         profileID,
		Data:        key,
		Label:       "Pollis Encryption Key",
		Description: "Encryption key for secure messaging",
	}

	if err := ks.ring.Set(item); err != nil {
		return fmt.Errorf("failed to store key: %w", err)
	}

	return nil
}

// GetEncryptionKey retrieves the encryption key for a profile
func (ks *KeychainService) GetEncryptionKey(profileID string) ([]byte, error) {
	item, err := ks.ring.Get(profileID)
	if err != nil {
		return nil, fmt.Errorf("failed to get key: %w", err)
	}

	return item.Data, nil
}

// DeleteEncryptionKey removes the encryption key for a profile
func (ks *KeychainService) DeleteEncryptionKey(profileID string) error {
	if err := ks.ring.Remove(profileID); err != nil {
		return fmt.Errorf("failed to delete key: %w", err)
	}

	return nil
}

// KeyExists checks if a key exists for a profile
func (ks *KeychainService) KeyExists(profileID string) bool {
	_, err := ks.ring.Get(profileID)
	return err == nil
}

// StoreSession stores the user session (userID and clerkToken) in the keychain
func (ks *KeychainService) StoreSession(userID string, clerkToken string) error {
	// Store session data as JSON-encoded string
	sessionData := fmt.Sprintf("%s:%s", userID, clerkToken)
	item := keyring.Item{
		Key:         "pollis_session",
		Data:        []byte(sessionData),
		Label:       "Pollis Session",
		Description: "Authentication session for Pollis",
	}

	if err := ks.ring.Set(item); err != nil {
		return fmt.Errorf("failed to store session: %w", err)
	}

	return nil
}

// GetStoredSession retrieves the stored session from the keychain
// Returns userID, clerkToken, and error
func (ks *KeychainService) GetStoredSession() (string, string, error) {
	item, err := ks.ring.Get("pollis_session")
	if err != nil {
		// Return empty strings if session not found (don't treat as error)
		if err == keyring.ErrKeyNotFound {
			return "", "", nil
		}
		return "", "", fmt.Errorf("failed to get session: %w", err)
	}

	// Parse session data (format: "userID:clerkToken")
	sessionData := string(item.Data)
	parts := strings.SplitN(sessionData, ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid session format")
	}

	return parts[0], parts[1], nil
}

// ClearSession removes the stored session from the keychain
func (ks *KeychainService) ClearSession() error {
	if err := ks.ring.Remove("pollis_session"); err != nil {
		// Ignore error if session doesn't exist
		if err != keyring.ErrKeyNotFound {
			return fmt.Errorf("failed to clear session: %w", err)
		}
	}
	return nil
}

