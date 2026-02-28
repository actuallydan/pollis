package services

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	pollispb "pollis/pkg/proto"
)

// Note: The proto package is generated from pkg/proto/pollis.proto
// Run: protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative pkg/proto/pollis.proto

// ServiceClient handles gRPC communication with the Pollis service
type ServiceClient struct {
	conn   *grpc.ClientConn
	client pollispb.PollisServiceClient
	ctx    context.Context
}

// NewServiceClient creates a new gRPC service client
func NewServiceClient(serviceURL string) (*ServiceClient, error) {
	ctx := context.Background()

	// Create gRPC connection (in production, use TLS credentials)
	conn, err := grpc.NewClient(serviceURL, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to service: %w", err)
	}

	client := pollispb.NewPollisServiceClient(conn)

	return &ServiceClient{
		conn:   conn,
		client: client,
		ctx:    ctx,
	}, nil
}

// Close closes the gRPC connection
func (c *ServiceClient) Close() error {
	return c.conn.Close()
}

// RegisterPreKeys uploads identity + pre-keys for X3DH
func (c *ServiceClient) RegisterPreKeys(userID string, identityKey, signedPreKey, signedPreKeySig []byte, oneTimePreKeys [][]byte) error {
	req := &pollispb.RegisterPreKeysRequest{
		UserId:          userID,
		IdentityKey:     identityKey,
		SignedPreKey:    signedPreKey,
		SignedPreKeySig: signedPreKeySig,
		OneTimePreKeys:  oneTimePreKeys,
	}
	if _, err := c.client.RegisterPreKeys(c.ctx, req); err != nil {
		return fmt.Errorf("failed to register pre-keys: %w", err)
	}
	return nil
}

// GetPreKeyBundle fetches a recipient bundle for X3DH
func (c *ServiceClient) GetPreKeyBundle(userIdentifier string) (*pollispb.GetPreKeyBundleResponse, error) {
	req := &pollispb.GetPreKeyBundleRequest{UserIdentifier: userIdentifier}
	resp, err := c.client.GetPreKeyBundle(c.ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get pre-key bundle: %w", err)
	}
	return resp, nil
}

// RotateSignedPreKey rotates signed pre-key
func (c *ServiceClient) RotateSignedPreKey(userID string, signedPreKey, signedPreKeySig []byte) error {
	req := &pollispb.RotateSignedPreKeyRequest{
		UserId:          userID,
		SignedPreKey:    signedPreKey,
		SignedPreKeySig: signedPreKeySig,
	}
	if _, err := c.client.RotateSignedPreKey(c.ctx, req); err != nil {
		return fmt.Errorf("failed to rotate signed pre-key: %w", err)
	}
	return nil
}

// SendKeyExchange sends a key exchange message
func (c *ServiceClient) SendKeyExchange(fromUserID, toUserIdentifier, messageType string, encryptedData []byte, expiresInSeconds int64) (string, error) {
	req := &pollispb.SendKeyExchangeRequest{
		FromUserId:       fromUserID,
		ToUserIdentifier: toUserIdentifier,
		MessageType:      messageType,
		EncryptedData:    encryptedData,
		ExpiresInSeconds: expiresInSeconds,
	}

	resp, err := c.client.SendKeyExchange(c.ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to send key exchange: %w", err)
	}

	return resp.MessageId, nil
}

// GetKeyExchangeMessages retrieves key exchange messages for a user
func (c *ServiceClient) GetKeyExchangeMessages(userIdentifier string) ([]*pollispb.KeyExchangeMessage, error) {
	req := &pollispb.GetKeyExchangeMessagesRequest{
		UserIdentifier: userIdentifier,
	}

	resp, err := c.client.GetKeyExchangeMessages(c.ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get key exchange messages: %w", err)
	}

	return resp.Messages, nil
}

// MarkKeyExchangeRead marks key exchange messages as read
func (c *ServiceClient) MarkKeyExchangeRead(messageIDs []string) error {
	req := &pollispb.MarkKeyExchangeReadRequest{
		MessageIds: messageIDs,
	}

	_, err := c.client.MarkKeyExchangeRead(c.ctx, req)
	if err != nil {
		return fmt.Errorf("failed to mark key exchange as read: %w", err)
	}

	return nil
}

// GetSenderKey fetches current sender key for group/channel
func (c *ServiceClient) GetSenderKey(groupID, channelID string) (*pollispb.GetSenderKeyResponse, error) {
	req := &pollispb.GetSenderKeyRequest{
		GroupId:   groupID,
		ChannelId: channelID,
	}
	resp, err := c.client.GetSenderKey(c.ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get sender key: %w", err)
	}
	return resp, nil
}

// DistributeSenderKey uploads sender key and recipient mapping
func (c *ServiceClient) DistributeSenderKey(groupID, channelID string, senderKey []byte, keyVersion int32, recipients []string) error {
	req := &pollispb.DistributeSenderKeyRequest{
		GroupId:              groupID,
		ChannelId:            channelID,
		SenderKey:            senderKey,
		KeyVersion:           keyVersion,
		RecipientIdentifiers: recipients,
	}
	if _, err := c.client.DistributeSenderKey(c.ctx, req); err != nil {
		return fmt.Errorf("failed to distribute sender key: %w", err)
	}
	return nil
}

// SendWebRTCSignal sends a WebRTC signaling message
func (c *ServiceClient) SendWebRTCSignal(fromUserID, toUserID, signalType, signalData string, expiresInSeconds int64) (string, error) {
	req := &pollispb.SendWebRTCSignalRequest{
		FromUserId:       fromUserID,
		ToUserId:         toUserID,
		SignalType:       signalType,
		SignalData:       signalData,
		ExpiresInSeconds: expiresInSeconds,
	}

	resp, err := c.client.SendWebRTCSignal(c.ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to send WebRTC signal: %w", err)
	}

	return resp.SignalId, nil
}

// GetWebRTCSignals retrieves WebRTC signaling messages for a user
func (c *ServiceClient) GetWebRTCSignals(userID string) ([]*pollispb.WebRTCSignal, error) {
	req := &pollispb.GetWebRTCSignalsRequest{
		UserId: userID,
	}

	resp, err := c.client.GetWebRTCSignals(c.ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get WebRTC signals: %w", err)
	}

	return resp.Signals, nil
}

// WithTimeout creates a context with timeout for gRPC calls
func (c *ServiceClient) WithTimeout(timeout time.Duration) context.Context {
	ctx, _ := context.WithTimeout(c.ctx, timeout)
	return ctx
}

// WithMetadata adds metadata to the context
func (c *ServiceClient) WithMetadata(ctx context.Context, key, value string) context.Context {
	return metadata.AppendToOutgoingContext(ctx, key, value)
}
