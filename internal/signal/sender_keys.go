package signal

import (
	"crypto/rand"
	"fmt"
	"pollis/internal/encryption"
)

// SenderKey represents a group sender key
type SenderKey struct {
	KeyData  []byte
	Version  int
}

// GenerateSenderKey creates a new sender key for a group/channel
func GenerateSenderKey() (*SenderKey, error) {
	key, err := encryption.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("generate sender key: %w", err)
	}
	return &SenderKey{KeyData: key, Version: 1}, nil
}

// EncryptWithSenderKey encrypts plaintext using AES-256-GCM with provided sender key
func EncryptWithSenderKey(senderKey []byte, plaintext []byte) ([]byte, []byte, error) {
	nonce := make([]byte, encryption.NonceSize)
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, fmt.Errorf("nonce: %w", err)
	}
	ct, err := encryption.EncryptWithNonce(plaintext, senderKey, nonce)
	if err != nil {
		return nil, nil, err
	}
	return ct, nonce, nil
}

// DecryptWithSenderKey decrypts ciphertext using AES-256-GCM with provided sender key
func DecryptWithSenderKey(senderKey []byte, ciphertext []byte, nonce []byte) ([]byte, error) {
	return encryption.DecryptWithNonce(ciphertext, senderKey, nonce)
}

