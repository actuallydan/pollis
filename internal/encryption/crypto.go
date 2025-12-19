package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/pbkdf2"
)

const (
	// KeySize is the size of the encryption key in bytes (AES-256)
	KeySize = 32
	// NonceSize is the size of the nonce for GCM (12 bytes recommended)
	NonceSize = 12
	// SaltSize is the size of the salt for key derivation
	SaltSize = 32
	// PBKDF2Iterations is the number of iterations for key derivation
	PBKDF2Iterations = 100000
)

// Encrypt encrypts data using AES-256-GCM with a provided key
func Encrypt(data []byte, key []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", KeySize, len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, NonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return ciphertext, nil
}

// Decrypt decrypts data using AES-256-GCM with a provided key
func Decrypt(encryptedData []byte, key []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", KeySize, len(key))
	}

	if len(encryptedData) < NonceSize {
		return nil, errors.New("encrypted data too short")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := encryptedData[:NonceSize]
	ciphertext := encryptedData[NonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// EncryptWithNonce encrypts data using AES-256-GCM with supplied nonce (12 bytes)
func EncryptWithNonce(data []byte, key []byte, nonce []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", KeySize, len(key))
	}
	if len(nonce) != NonceSize {
		return nil, fmt.Errorf("invalid nonce size: expected %d bytes, got %d", NonceSize, len(nonce))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	return gcm.Seal(nil, nonce, data, nil), nil
}

// DecryptWithNonce decrypts data using AES-256-GCM with supplied nonce (12 bytes)
func DecryptWithNonce(ciphertext []byte, key []byte, nonce []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", KeySize, len(key))
	}
	if len(nonce) != NonceSize {
		return nil, fmt.Errorf("invalid nonce size: expected %d bytes, got %d", NonceSize, len(nonce))
	}
	if len(ciphertext) == 0 {
		return nil, errors.New("ciphertext empty")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// DeriveKey derives an encryption key from a password using PBKDF2
func DeriveKey(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, PBKDF2Iterations, KeySize, sha256.New)
}

// DeriveKeyArgon2id derives a key using Argon2id (preferred)
func DeriveKeyArgon2id(password string, salt []byte, memMB uint32, iterations uint32, parallelism uint8) []byte {
	if salt == nil || len(salt) == 0 {
		salt = make([]byte, SaltSize)
		_, _ = rand.Read(salt)
	}
	return argon2.IDKey([]byte(password), salt, iterations, memMB*1024, parallelism, KeySize)
}

// EncodeSaltedHash serializes salt+hash for storage (salt || hash)
func EncodeSaltedHash(salt, hash []byte) []byte {
	buf := make([]byte, 2+len(salt)+len(hash))
	binary.BigEndian.PutUint16(buf[:2], uint16(len(salt)))
	copy(buf[2:], salt)
	copy(buf[2+len(salt):], hash)
	return buf
}

// DecodeSaltedHash parses salt+hash (salt || hash)
func DecodeSaltedHash(data []byte) (salt, hash []byte, err error) {
	if len(data) < 2 {
		return nil, nil, errors.New("invalid salted hash")
	}
	sz := int(binary.BigEndian.Uint16(data[:2]))
	if len(data) < 2+sz {
		return nil, nil, errors.New("invalid salted hash length")
	}
	salt = data[2 : 2+sz]
	hash = data[2+sz:]
	return
}

// GenerateSalt generates a random salt for key derivation
func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	return salt, nil
}

// GenerateKey generates a random encryption key
func GenerateKey() ([]byte, error) {
	key := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}
	return key, nil
}

// HashPassword creates a hash of a password (for future use)
func HashPassword(password string) ([]byte, []byte, error) {
	salt, err := GenerateSalt()
	if err != nil {
		return nil, nil, err
	}

	hash := pbkdf2.Key([]byte(password), salt, PBKDF2Iterations, KeySize, sha256.New)
	return hash, salt, nil
}

// VerifyPassword verifies a password against a hash (for future use)
func VerifyPassword(password string, hash []byte, salt []byte) bool {
	derivedHash := pbkdf2.Key([]byte(password), salt, PBKDF2Iterations, KeySize, sha256.New)
	return len(hash) == len(derivedHash) && subtleConstantTimeCompare(hash, derivedHash)
}

// subtleConstantTimeCompare performs a constant-time comparison
func subtleConstantTimeCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	result := byte(0)
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

