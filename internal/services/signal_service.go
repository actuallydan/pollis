package services

import (
	"encoding/json"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/signal"

	"golang.org/x/crypto/ed25519"
)

// SignalService wraps Signal protocol operations with database integration
type SignalService struct {
	protocol         *signal.SignalProtocol
	sessionService   *SignalSessionService
	groupKeyService  *GroupKeyService
}

// NewSignalService creates a new Signal service
func NewSignalService(sessionService *SignalSessionService, groupKeyService *GroupKeyService) *SignalService {
	return &SignalService{
		protocol:        signal.NewSignalProtocol(),
		sessionService:  sessionService,
		groupKeyService: groupKeyService,
	}
}

// GenerateIdentityKeyPair generates a new Signal identity key pair (Ed25519)
func (s *SignalService) GenerateIdentityKeyPair() ([]byte, []byte, error) {
	return s.protocol.GenerateIdentityKeyPair()
}

// GeneratePreKeys produces SPK + OPKs
func (s *SignalService) GeneratePreKeys(identityPriv []byte) (spkPriv, spkPub, spkSig []byte, opks [][2][]byte, err error) {
	return s.protocol.GeneratePreKeys(ed25519.PrivateKey(identityPriv))
}

// CreateSessionFromPreKeyBundle establishes a session using X3DH
func (s *SignalService) CreateSessionFromPreKeyBundle(localUserID, remoteIdentifier string, localIKPriv []byte, localEPPriv []byte, bundle signal.PreKeyBundle) (*models.SignalSession, error) {
	state, err := s.protocol.CreateSessionFromPreKeyBundle(ed25519.PrivateKey(localIKPriv), localEPPriv, bundle)
	if err != nil {
		return nil, err
	}
	stateBytes, err := signal.SerializeState(state)
	if err != nil {
		return nil, fmt.Errorf("serialize state: %w", err)
	}

	session := &models.SignalSession{
		ID:                   "",
		LocalUserID:          localUserID,
		RemoteUserIdentifier: remoteIdentifier,
		SessionData:          stateBytes,
		CreatedAt:            state.CreatedAt,
		UpdatedAt:            state.UpdatedAt,
	}

	if err := s.sessionService.CreateOrUpdateSession(session); err != nil {
		return nil, err
	}
	return session, nil
}

// GetSessionState loads ratchet state from session model
func (s *SignalService) GetSessionState(session *models.SignalSession) (*signal.RatchetState, error) {
	return signal.DeserializeState(session.SessionData)
}

// SaveSessionState updates session model with new state
func (s *SignalService) SaveSessionState(session *models.SignalSession, state *signal.RatchetState) error {
	data, err := signal.SerializeState(state)
	if err != nil {
		return fmt.Errorf("serialize state: %w", err)
	}
	session.SessionData = data
	session.UpdatedAt = state.UpdatedAt
	return s.sessionService.CreateOrUpdateSession(session)
}

// EncryptMessage encrypts a message using double ratchet
func (s *SignalService) EncryptMessage(session *models.SignalSession, plaintext []byte) ([]byte, error) {
	state, err := s.GetSessionState(session)
	if err != nil {
		return nil, fmt.Errorf("load state: %w", err)
	}

	em, newState, err := s.protocol.EncryptMessage(state, plaintext)
	if err != nil {
		return nil, err
	}

	if err := s.SaveSessionState(session, newState); err != nil {
		return nil, err
	}

	return json.Marshal(em)
}

// DecryptMessage decrypts a message using double ratchet
func (s *SignalService) DecryptMessage(session *models.SignalSession, ciphertext []byte) ([]byte, error) {
	state, err := s.GetSessionState(session)
	if err != nil {
		return nil, fmt.Errorf("load state: %w", err)
	}

	var em signal.EncryptedMessage
	if err := json.Unmarshal(ciphertext, &em); err != nil {
		return nil, fmt.Errorf("parse encrypted message: %w", err)
	}

	pt, newState, err := s.protocol.DecryptMessage(state, &em)
	if err != nil {
		return nil, err
	}

	if err := s.SaveSessionState(session, newState); err != nil {
		return nil, err
	}

	return pt, nil
}

// Sender key helpers for groups
func (s *SignalService) GetOrCreateSenderKey(groupID, channelID string) ([]byte, error) {
	key, err := s.groupKeyService.GetLatestSenderKey(groupID, channelID)
	if err != nil {
		return nil, err
	}
	if key != nil {
		return key.KeyData, nil
	}
	sk, err := signal.GenerateSenderKey()
	if err != nil {
		return nil, err
	}
	if err := s.groupKeyService.SaveSenderKey(groupID, channelID, sk.KeyData, sk.Version); err != nil {
		return nil, err
	}
	return sk.KeyData, nil
}

func (s *SignalService) RotateSenderKey(groupID, channelID string) ([]byte, error) {
	sk, err := signal.GenerateSenderKey()
	if err != nil {
		return nil, err
	}
	latest, _ := s.groupKeyService.GetLatestSenderKey(groupID, channelID)
	version := 1
	if latest != nil {
		version = latest.KeyVersion + 1
	}
	if err := s.groupKeyService.SaveSenderKey(groupID, channelID, sk.KeyData, version); err != nil {
		return nil, err
	}
	return sk.KeyData, nil
}

