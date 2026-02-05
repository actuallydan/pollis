package handlers

import (
	"context"
	"fmt"

	"pollis-service/internal/services"
	"pollis/pkg/proto"
)

// PollisHandler implements the PollisService gRPC service
// Server handles ONLY: signaling, key exchange, message relay
// Desktop app handles CRUD directly via Turso
type PollisHandler struct {
	proto.UnimplementedPollisServiceServer
	keyExchangeService *services.KeyExchangeService
	webrtcService      *services.WebRTCService
	preKeyService      *services.PreKeyService
	senderKeyService   *services.SenderKeyService
	keyBackupService   *services.KeyBackupService
}

// NewPollisHandler creates a new PollisHandler
func NewPollisHandler(
	keyExchangeService *services.KeyExchangeService,
	webrtcService *services.WebRTCService,
	preKeyService *services.PreKeyService,
	senderKeyService *services.SenderKeyService,
	keyBackupService *services.KeyBackupService,
) *PollisHandler {
	return &PollisHandler{
		keyExchangeService: keyExchangeService,
		webrtcService:      webrtcService,
		preKeyService:      preKeyService,
		senderKeyService:   senderKeyService,
		keyBackupService:   keyBackupService,
	}
}

// ============================================
// Pre-Key / Identity Management
// ============================================

// RegisterPreKeys registers identity key, signed pre-key, and one-time pre-keys
func (h *PollisHandler) RegisterPreKeys(ctx context.Context, req *proto.RegisterPreKeysRequest) (*proto.RegisterPreKeysResponse, error) {
	err := h.preKeyService.RegisterPreKeys(
		req.UserId,
		req.IdentityKey,
		req.SignedPreKey,
		req.SignedPreKeySig,
		req.OneTimePreKeys,
	)
	if err != nil {
		return &proto.RegisterPreKeysResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to register pre-keys: %v", err),
		}, nil
	}
	return &proto.RegisterPreKeysResponse{
		Success: true,
		Message: "Pre-keys registered successfully",
	}, nil
}

// GetPreKeyBundle returns bundle for a user and consumes one OTPK
func (h *PollisHandler) GetPreKeyBundle(ctx context.Context, req *proto.GetPreKeyBundleRequest) (*proto.GetPreKeyBundleResponse, error) {
	bundle, otpk, err := h.preKeyService.GetPreKeyBundle(req.UserIdentifier)
	if err != nil {
		return nil, fmt.Errorf("failed to get pre-key bundle: %w", err)
	}

	resp := &proto.GetPreKeyBundleResponse{
		UserId:          bundle.UserID,
		IdentityKey:     bundle.IdentityKey,
		SignedPreKey:    bundle.SignedPreKey,
		SignedPreKeySig: bundle.SignedPreKeySig,
	}
	if len(otpk) > 0 {
		resp.OneTimePreKey = otpk
	}
	return resp, nil
}

// RotateSignedPreKey updates the signed pre-key after verifying signature
func (h *PollisHandler) RotateSignedPreKey(ctx context.Context, req *proto.RotateSignedPreKeyRequest) (*proto.RotateSignedPreKeyResponse, error) {
	err := h.preKeyService.RotateSignedPreKey(
		req.UserId,
		req.SignedPreKey,
		req.SignedPreKeySig,
	)
	if err != nil {
		return &proto.RotateSignedPreKeyResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to rotate signed pre-key: %v", err),
		}, nil
	}

	return &proto.RotateSignedPreKeyResponse{
		Success: true,
		Message: "Signed pre-key rotated",
	}, nil
}

// ============================================
// Sender Key Distribution
// ============================================

// GetSenderKey returns current sender key for a group/channel
func (h *PollisHandler) GetSenderKey(ctx context.Context, req *proto.GetSenderKeyRequest) (*proto.GetSenderKeyResponse, error) {
	key, err := h.senderKeyService.GetSenderKey(req.GroupId, req.ChannelId)
	if err != nil {
		return &proto.GetSenderKeyResponse{
			Success: false,
		}, nil
	}

	return &proto.GetSenderKeyResponse{
		Success:    true,
		SenderKey:  key.SenderKey,
		KeyVersion: int32(key.KeyVersion),
		CreatedAt:  key.CreatedAt,
	}, nil
}

// DistributeSenderKey stores/rotates sender key and recipients
func (h *PollisHandler) DistributeSenderKey(ctx context.Context, req *proto.DistributeSenderKeyRequest) (*proto.DistributeSenderKeyResponse, error) {
	err := h.senderKeyService.DistributeSenderKey(
		req.GroupId,
		req.ChannelId,
		req.SenderKey,
		req.KeyVersion,
		req.RecipientIdentifiers,
	)
	if err != nil {
		return &proto.DistributeSenderKeyResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to distribute sender key: %v", err),
		}, nil
	}

	return &proto.DistributeSenderKeyResponse{
		Success: true,
		Message: "Sender key distributed",
	}, nil
}

// ============================================
// Key Exchange (X3DH coordination)
// ============================================

// SendKeyExchange sends a key exchange message
func (h *PollisHandler) SendKeyExchange(ctx context.Context, req *proto.SendKeyExchangeRequest) (*proto.SendKeyExchangeResponse, error) {
	messageID, err := h.keyExchangeService.SendKeyExchange(
		req.FromUserId,
		req.ToUserIdentifier,
		req.MessageType,
		req.EncryptedData,
		req.ExpiresInSeconds,
	)
	if err != nil {
		return &proto.SendKeyExchangeResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to send key exchange: %v", err),
		}, nil
	}

	return &proto.SendKeyExchangeResponse{
		Success:   true,
		MessageId: messageID,
		Message:   "Key exchange sent successfully",
	}, nil
}

// GetKeyExchangeMessages retrieves key exchange messages for a user
func (h *PollisHandler) GetKeyExchangeMessages(ctx context.Context, req *proto.GetKeyExchangeMessagesRequest) (*proto.GetKeyExchangeMessagesResponse, error) {
	messages, err := h.keyExchangeService.GetKeyExchangeMessages(req.UserIdentifier)
	if err != nil {
		return nil, fmt.Errorf("failed to get key exchange messages: %w", err)
	}

	resp := &proto.GetKeyExchangeMessagesResponse{
		Messages: make([]*proto.KeyExchangeMessage, len(messages)),
	}

	for i, msg := range messages {
		resp.Messages[i] = &proto.KeyExchangeMessage{
			MessageId:     msg.ID,
			FromUserId:    msg.FromUserID,
			MessageType:   msg.MessageType,
			EncryptedData: msg.EncryptedData,
			CreatedAt:     msg.CreatedAt,
		}
	}

	return resp, nil
}

// MarkKeyExchangeRead marks key exchange messages as read
func (h *PollisHandler) MarkKeyExchangeRead(ctx context.Context, req *proto.MarkKeyExchangeReadRequest) (*proto.MarkKeyExchangeReadResponse, error) {
	err := h.keyExchangeService.MarkKeyExchangeRead(req.MessageIds)
	if err != nil {
		return &proto.MarkKeyExchangeReadResponse{
			Success: false,
		}, nil
	}

	return &proto.MarkKeyExchangeReadResponse{
		Success: true,
	}, nil
}

// ============================================
// WebRTC Signaling
// ============================================

// SendWebRTCSignal sends a WebRTC signaling message
func (h *PollisHandler) SendWebRTCSignal(ctx context.Context, req *proto.SendWebRTCSignalRequest) (*proto.SendWebRTCSignalResponse, error) {
	signalID, err := h.webrtcService.SendWebRTCSignal(
		req.FromUserId,
		req.ToUserId,
		req.SignalType,
		req.SignalData,
		req.ExpiresInSeconds,
	)
	if err != nil {
		return &proto.SendWebRTCSignalResponse{
			Success: false,
		}, nil
	}

	return &proto.SendWebRTCSignalResponse{
		Success:  true,
		SignalId: signalID,
	}, nil
}

// GetWebRTCSignals retrieves WebRTC signals for a user
func (h *PollisHandler) GetWebRTCSignals(ctx context.Context, req *proto.GetWebRTCSignalsRequest) (*proto.GetWebRTCSignalsResponse, error) {
	signals, err := h.webrtcService.GetWebRTCSignals(req.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to get WebRTC signals: %w", err)
	}

	resp := &proto.GetWebRTCSignalsResponse{
		Signals: make([]*proto.WebRTCSignal, len(signals)),
	}

	for i, signal := range signals {
		resp.Signals[i] = &proto.WebRTCSignal{
			SignalId:   signal.ID,
			FromUserId: signal.FromUserID,
			SignalType: signal.SignalType,
			SignalData: signal.SignalData,
			CreatedAt:  signal.CreatedAt,
		}
	}

	return resp, nil
}

// ============================================
// Key Backup (for device recovery)
// ============================================

// StoreKeyBackup stores an encrypted key backup for a user
func (h *PollisHandler) StoreKeyBackup(ctx context.Context, req *proto.StoreKeyBackupRequest) (*proto.StoreKeyBackupResponse, error) {
	err := h.keyBackupService.StoreKeyBackup(req.UserId, req.EncryptedKey)
	if err != nil {
		return &proto.StoreKeyBackupResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to store key backup: %v", err),
		}, nil
	}

	return &proto.StoreKeyBackupResponse{
		Success: true,
		Message: "Key backup stored successfully",
	}, nil
}

// GetKeyBackup retrieves an encrypted key backup for a user
func (h *PollisHandler) GetKeyBackup(ctx context.Context, req *proto.GetKeyBackupRequest) (*proto.GetKeyBackupResponse, error) {
	backup, err := h.keyBackupService.GetKeyBackup(req.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to get key backup: %w", err)
	}

	return &proto.GetKeyBackupResponse{
		EncryptedKey: backup.EncryptedKey,
	}, nil
}
