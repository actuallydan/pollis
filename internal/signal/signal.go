package signal

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"pollis/internal/encryption"
	"time"

	"golang.org/x/crypto/curve25519"
	"golang.org/x/crypto/ed25519"
	"golang.org/x/crypto/hkdf"
)

const (
	maxSkippedMessageKeys = 2000
	kdfInfoRoot           = "PollisV3.RootKDF"
	kdfInfoChain          = "PollisV3.ChainKDF"
	kdfInfoMsg            = "PollisV3.MsgKDF"
)

// PreKeyBundle represents the bundle used for X3DH
type PreKeyBundle struct {
	IdentityKey      []byte `json:"identity_key"`       // Ed25519 public key
	SignedPreKey     []byte `json:"signed_pre_key"`     // X25519 public key
	SignedPreKeySig  []byte `json:"signed_pre_key_sig"` // Ed25519 signature over SPK
	OneTimePreKey    []byte `json:"one_time_pre_key"`   // Optional X25519 public key
}

// RatchetState represents the double ratchet session state
type RatchetState struct {
	RootKey        []byte            `json:"root_key"`
	SendChainKey   []byte            `json:"send_chain_key"`
	RecvChainKey   []byte            `json:"recv_chain_key"`
	SendDHPriv     []byte            `json:"send_dh_priv"`
	SendDHPub      []byte            `json:"send_dh_pub"`
	RecvDHPub      []byte            `json:"recv_dh_pub"`
	SendCount      uint32            `json:"send_count"`
	RecvCount      uint32            `json:"recv_count"`
	PrevRecvCount  uint32            `json:"prev_recv_count"`
	SkippedMsgKeys map[string][]byte `json:"skipped_msg_keys"` // key: dh_pub||counter
	CreatedAt      int64             `json:"created_at"`
	UpdatedAt      int64             `json:"updated_at"`
}

// MessageHeader contains ratchet header data
type MessageHeader struct {
	DHPub   []byte `json:"dh_pub"`
	PN      uint32 `json:"pn"`
	Counter uint32 `json:"counter"`
}

// EncryptedMessage is the transport wrapper
type EncryptedMessage struct {
	Header     MessageHeader `json:"header"`
	Ciphertext []byte        `json:"ciphertext"`
	Nonce      []byte        `json:"nonce"`
}

// SignalProtocol implements X3DH + Double Ratchet
type SignalProtocol struct{}

// NewSignalProtocol creates a new Signal protocol instance
func NewSignalProtocol() *SignalProtocol {
	return &SignalProtocol{}
}

// GenerateIdentityKeyPair returns Ed25519 key pair (public, private)
func (s *SignalProtocol) GenerateIdentityKeyPair() ([]byte, []byte, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate identity key: %w", err)
	}
	return pub, priv, nil
}

// GeneratePreKeys generates signed pre-key + 100 one-time pre-keys
func (s *SignalProtocol) GeneratePreKeys(identityPriv ed25519.PrivateKey) (signedPreKeyPriv, signedPreKeyPub []byte, signedPreKeySig []byte, oneTimePreKeys [][2][]byte, err error) {
	spkPriv := make([]byte, 32)
	if _, err = io.ReadFull(rand.Reader, spkPriv); err != nil {
		return
	}
	spkPub, err2 := curve25519.X25519(spkPriv, curve25519.Basepoint)
	if err2 != nil {
		err = fmt.Errorf("derive spk pub: %w", err2)
		return
	}
	sig := ed25519.Sign(identityPriv, spkPub)

	opks := make([][2][]byte, 0, 100)
	for i := 0; i < 100; i++ {
		priv := make([]byte, 32)
		if _, err = io.ReadFull(rand.Reader, priv); err != nil {
			return
		}
		pub, err2 := curve25519.X25519(priv, curve25519.Basepoint)
		if err2 != nil {
			err = fmt.Errorf("derive opk pub: %w", err2)
			return
		}
		opks = append(opks, [2][]byte{priv, pub})
	}

	return spkPriv, spkPub, sig, opks, nil
}

// CreateSessionFromPreKeyBundle performs X3DH to establish root key
func (s *SignalProtocol) CreateSessionFromPreKeyBundle(localIKPriv ed25519.PrivateKey, localEPPriv []byte, bundle PreKeyBundle) (*RatchetState, error) {
	if len(bundle.IdentityKey) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid identity key size")
	}
	if !ed25519.Verify(bundle.IdentityKey, bundle.SignedPreKey, bundle.SignedPreKeySig) {
		return nil, fmt.Errorf("invalid signed pre-key signature")
	}

	dh1, err := curve25519.X25519(localEPPriv, bundle.SignedPreKey)
	if err != nil {
		return nil, fmt.Errorf("dh1: %w", err)
	}
	dh2, err := curve25519.X25519(localEPPriv, bundle.IdentityKey[:32])
	if err != nil {
		return nil, fmt.Errorf("dh2: %w", err)
	}
	dh3, err := curve25519.X25519(localIKPriv.Seed()[:32], bundle.SignedPreKey)
	if err != nil {
		return nil, fmt.Errorf("dh3: %w", err)
	}

	var dh4 []byte
	if len(bundle.OneTimePreKey) == 32 {
		dh4, err = curve25519.X25519(localEPPriv, bundle.OneTimePreKey)
		if err != nil {
			return nil, fmt.Errorf("dh4: %w", err)
		}
	}

	concat := bytes.Join([][]byte{dh1, dh2, dh3, dh4}, nil)
	rootKey := hkdfDerive(nil, concat, []byte(kdfInfoRoot), 32)

	sendPriv := make([]byte, 32)
	if _, err = io.ReadFull(rand.Reader, sendPriv); err != nil {
		return nil, fmt.Errorf("generate send priv: %w", err)
	}
	sendPub, err := curve25519.X25519(sendPriv, curve25519.Basepoint)
	if err != nil {
		return nil, fmt.Errorf("derive send pub: %w", err)
	}

	state := &RatchetState{
		RootKey:        rootKey,
		SendChainKey:   nil,
		RecvChainKey:   nil,
		SendDHPriv:     sendPriv,
		SendDHPub:      sendPub,
		RecvDHPub:      bundle.SignedPreKey,
		SendCount:      0,
		RecvCount:      0,
		PrevRecvCount:  0,
		SkippedMsgKeys: make(map[string][]byte),
		CreatedAt:      time.Now().Unix(),
		UpdatedAt:      time.Now().Unix(),
	}

	if err := state.ratchetStep(bundle.SignedPreKey); err != nil {
		return nil, err
	}

	return state, nil
}

// EncryptMessage performs double ratchet encryption and updates state
func (s *SignalProtocol) EncryptMessage(state *RatchetState, plaintext []byte) (*EncryptedMessage, *RatchetState, error) {
	if state == nil {
		return nil, nil, errors.New("nil state")
	}

	msgKey, nextCK := deriveMessageKey(state.SendChainKey)
	state.SendChainKey = nextCK

	nonce := make([]byte, encryption.NonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("nonce: %w", err)
	}

	ciphertext, err := encryption.EncryptWithNonce(plaintext, msgKey, nonce)
	if err != nil {
		return nil, nil, fmt.Errorf("encrypt: %w", err)
	}

	header := MessageHeader{
		DHPub:   state.SendDHPub,
		PN:      state.PrevRecvCount,
		Counter: state.SendCount,
	}
	state.SendCount++
	state.UpdatedAt = time.Now().Unix()

	return &EncryptedMessage{
		Header:     header,
		Ciphertext: ciphertext,
		Nonce:      nonce,
	}, state, nil
}

// DecryptMessage performs double ratchet decryption and updates state
func (s *SignalProtocol) DecryptMessage(state *RatchetState, msg *EncryptedMessage) ([]byte, *RatchetState, error) {
	if state == nil {
		return nil, nil, errors.New("nil state")
	}

	keyID := skippedKeyIdentifier(msg.Header.DHPub, msg.Header.Counter)
	if key, ok := state.SkippedMsgKeys[keyID]; ok {
		plaintext, err := encryption.DecryptWithNonce(msg.Ciphertext, key, msg.Nonce)
		if err == nil {
			delete(state.SkippedMsgKeys, keyID)
			return plaintext, state, nil
		}
	}

	if !bytes.Equal(msg.Header.DHPub, state.RecvDHPub) {
		if err := state.skipMessageKeys(msg.Header.PN); err != nil {
			return nil, nil, err
		}
		if err := state.ratchetStep(msg.Header.DHPub); err != nil {
			return nil, nil, err
		}
	}

	if msg.Header.Counter < state.RecvCount {
		return nil, nil, fmt.Errorf("message already processed")
	}
	for state.RecvCount < msg.Header.Counter {
		mk, nextCK := deriveMessageKey(state.RecvChainKey)
		state.RecvChainKey = nextCK
		state.storeSkippedKey(msg.Header.DHPub, state.RecvCount, mk)
		state.RecvCount++
	}

	mk, nextCK := deriveMessageKey(state.RecvChainKey)
	state.RecvChainKey = nextCK
	state.RecvCount++

	plaintext, err := encryption.DecryptWithNonce(msg.Ciphertext, mk, msg.Nonce)
	if err != nil {
		return nil, nil, fmt.Errorf("decrypt: %w", err)
	}

	state.UpdatedAt = time.Now().Unix()
	return plaintext, state, nil
}

// SerializeState encodes ratchet state to JSON
func SerializeState(state *RatchetState) ([]byte, error) {
	return json.Marshal(state)
}

// DeserializeState decodes ratchet state from JSON
func DeserializeState(data []byte) (*RatchetState, error) {
	var st RatchetState
	if err := json.Unmarshal(data, &st); err != nil {
		return nil, err
	}
	if st.SkippedMsgKeys == nil {
		st.SkippedMsgKeys = make(map[string][]byte)
	}
	return &st, nil
}

// Utility functions
func hkdfDerive(salt, ikm, info []byte, size int) []byte {
	r := hkdf.New(sha256.New, ikm, salt, info)
	out := make([]byte, size)
	if _, err := io.ReadFull(r, out); err != nil {
		panic(err)
	}
	return out
}

func deriveChainKey(rootKey, dhOutput []byte) (newRoot []byte, chainKey []byte) {
	newRoot = hkdfDerive(rootKey, dhOutput, []byte(kdfInfoRoot), 32)
	chainKey = hkdfDerive(newRoot, dhOutput, []byte(kdfInfoChain), 32)
	return
}

func deriveMessageKey(chainKey []byte) (msgKey []byte, nextCK []byte) {
	if chainKey == nil {
		return hkdfDerive(nil, []byte("init"), []byte(kdfInfoMsg), 32), hkdfDerive(nil, []byte("initCK"), []byte(kdfInfoChain), 32)
	}
	msgKey = hkdfDerive(chainKey, []byte("0"), []byte(kdfInfoMsg), 32)
	nextCK = hkdfDerive(chainKey, []byte("1"), []byte(kdfInfoChain), 32)
	return
}

func (st *RatchetState) ratchetStep(remotePub []byte) error {
	dhOut, err := curve25519.X25519(st.SendDHPriv, remotePub)
	if err != nil {
		return fmt.Errorf("ratchet dh: %w", err)
	}
	newRoot, recvCK := deriveChainKey(st.RootKey, dhOut)

	newSendPriv := make([]byte, 32)
	if _, err = io.ReadFull(rand.Reader, newSendPriv); err != nil {
		return fmt.Errorf("generate ratchet priv: %w", err)
	}
	newSendPub, err := curve25519.X25519(newSendPriv, curve25519.Basepoint)
	if err != nil {
		return fmt.Errorf("derive ratchet pub: %w", err)
	}

	dhOut2, err := curve25519.X25519(newSendPriv, remotePub)
	if err != nil {
		return fmt.Errorf("ratchet dh2: %w", err)
	}
	newRoot2, sendCK := deriveChainKey(newRoot, dhOut2)

	st.RootKey = newRoot2
	st.SendChainKey = sendCK
	st.RecvChainKey = recvCK
	st.SendDHPriv = newSendPriv
	st.SendDHPub = newSendPub
	st.RecvDHPub = remotePub
	st.PrevRecvCount = st.RecvCount
	st.RecvCount = 0
	st.SendCount = 0
	return nil
}

func (st *RatchetState) storeSkippedKey(dhPub []byte, counter uint32, key []byte) {
	if len(st.SkippedMsgKeys) >= maxSkippedMessageKeys {
		for k := range st.SkippedMsgKeys {
			delete(st.SkippedMsgKeys, k)
			break
		}
	}
	st.SkippedMsgKeys[skippedKeyIdentifier(dhPub, counter)] = key
}

func (st *RatchetState) skipMessageKeys(until uint32) error {
	for st.RecvCount < until {
		mk, nextCK := deriveMessageKey(st.RecvChainKey)
		st.RecvChainKey = nextCK
		st.storeSkippedKey(st.RecvDHPub, st.RecvCount, mk)
		st.RecvCount++
	}
	return nil
}

func skippedKeyIdentifier(dhPub []byte, counter uint32) string {
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, counter)
	return base64.StdEncoding.EncodeToString(append(dhPub, buf...))
}

// Helper to sign arbitrary data with Ed25519
func Sign(data []byte, priv ed25519.PrivateKey) []byte {
	return ed25519.Sign(priv, data)
}

// VerifyEd25519 verifies signature
func VerifyEd25519(data, sig []byte, pub ed25519.PublicKey) bool {
	return ed25519.Verify(pub, data, sig)
}

// MAC helper (used for safety numbers / fingerprints)
func ComputeMAC(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

