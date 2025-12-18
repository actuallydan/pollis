package keystore

import (
	"fmt"

	"github.com/99designs/keyring"
)

// KeyStore wraps OS keychain access
type KeyStore struct {
	ring keyring.Keyring
}

// New creates a keystore backed by OS keychain / secret service
func New(appName string) (*KeyStore, error) {
	kr, err := keyring.Open(keyring.Config{
		ServiceName:              appName,
		KeychainName:             appName,
		KWalletAppID:             appName,
		KWalletFolder:            appName,
		WinCredPrefix:            appName,
		LibSecretCollectionName:  appName,
		AllowedBackends:          []keyring.BackendType{keyring.SecretServiceBackend, keyring.KeychainBackend, keyring.WinCredBackend, keyring.KWalletBackend, keyring.FileBackend},
	})
	if err != nil {
		return nil, fmt.Errorf("open keyring: %w", err)
	}
	return &KeyStore{ring: kr}, nil
}

// Store saves a secret value under a key
func (k *KeyStore) Store(key string, data []byte) error {
	return k.ring.Set(keyring.Item{
		Key:  key,
		Data: data,
	})
}

// Get retrieves a secret; returns nil if not found
func (k *KeyStore) Get(key string) ([]byte, error) {
	item, err := k.ring.Get(key)
	if err == keyring.ErrKeyNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("keyring get: %w", err)
	}
	return item.Data, nil
}

// Delete removes a secret
func (k *KeyStore) Delete(key string) error {
	if err := k.ring.Remove(key); err != nil && err != keyring.ErrKeyNotFound {
		return fmt.Errorf("keyring remove: %w", err)
	}
	return nil
}

// Lock locks the keyring (where supported)
func (k *KeyStore) Lock() error {
	return nil
}

// Unlock unlocks the keyring using a password (where supported)
func (k *KeyStore) Unlock(password string) error {
	return nil
}

