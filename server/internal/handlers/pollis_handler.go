package handlers

import (
	"context"
	"fmt"
	"log"

	"pollis-service/internal/services"
	"pollis/pkg/proto"
)

// AblyService interface for real-time messaging (optional)
type AblyService interface {
	PublishMessage(channelID string, data map[string]interface{}) error
}

// PollisHandler implements the PollisService gRPC service
type PollisHandler struct {
	proto.UnimplementedPollisServiceServer
	userService        *services.UserService
	groupService       *services.GroupService
	channelService     *services.ChannelService
	keyExchangeService *services.KeyExchangeService
	webrtcService      *services.WebRTCService
	preKeyService      *services.PreKeyService
	senderKeyService   *services.SenderKeyService
	keyBackupService   *services.KeyBackupService
}

// NewPollisHandler creates a new PollisHandler
func NewPollisHandler(
	userService *services.UserService,
	groupService *services.GroupService,
	channelService *services.ChannelService,
	keyExchangeService *services.KeyExchangeService,
	webrtcService *services.WebRTCService,
	preKeyService *services.PreKeyService,
	senderKeyService *services.SenderKeyService,
	keyBackupService *services.KeyBackupService,
) *PollisHandler {
	return &PollisHandler{
		userService:        userService,
		groupService:       groupService,
		channelService:     channelService,
		keyExchangeService: keyExchangeService,
		webrtcService:      webrtcService,
		preKeyService:      preKeyService,
		senderKeyService:   senderKeyService,
		keyBackupService:   keyBackupService,
	}
}

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

// RegisterUser handles user registration
func (h *PollisHandler) RegisterUser(ctx context.Context, req *proto.RegisterUserRequest) (*proto.RegisterUserResponse, error) {
	// Validate required fields
	if req.ClerkId == "" {
		log.Printf("[RegisterUser] ERROR: clerk_id is required")
		return &proto.RegisterUserResponse{
			Success: false,
			Message: "clerk_id is required",
		}, nil
	}

	log.Printf("[RegisterUser] Registering user: user_id=%s, clerk_id=%s, email=%v, phone=%v",
		req.UserId, req.ClerkId, req.Email, req.Phone)
	err := h.userService.RegisterUser(
		req.UserId,
		req.ClerkId,
		req.Email,
		req.Phone,
	)
	if err != nil {
		log.Printf("[RegisterUser] ERROR: Failed to register user %s: %v", req.UserId, err)
		return &proto.RegisterUserResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to register user: %v", err),
		}, nil
	}

	log.Printf("[RegisterUser] SUCCESS: User %s registered successfully", req.UserId)
	return &proto.RegisterUserResponse{
		Success: true,
		Message: "User registered successfully",
	}, nil
}

// GetUserByClerkID retrieves a user by Clerk ID
func (h *PollisHandler) GetUserByClerkID(ctx context.Context, req *proto.GetUserByClerkIDRequest) (*proto.GetUserByClerkIDResponse, error) {
	user, err := h.userService.GetUserByClerkID(req.ClerkId)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by clerk_id: %w", err)
	}

	// Return empty response if user not found (client will create new user)
	if user == nil {
		return &proto.GetUserByClerkIDResponse{}, nil
	}

	resp := &proto.GetUserByClerkIDResponse{
		UserId: user.ID,
	}

	return resp, nil
}

// GetUser retrieves a user by identifier
// Note: In the new schema, only ID and clerk_id are stored
func (h *PollisHandler) GetUser(ctx context.Context, req *proto.GetUserRequest) (*proto.GetUserResponse, error) {
	user, err := h.userService.GetUser(req.UserIdentifier)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	if user == nil {
		return &proto.GetUserResponse{}, nil
	}

	resp := &proto.GetUserResponse{
		UserId: user.ID,
	}

	return resp, nil
}

// SearchUsers searches for users
// Note: In the new schema, user search is deprecated (returns empty list)
func (h *PollisHandler) SearchUsers(ctx context.Context, req *proto.SearchUsersRequest) (*proto.SearchUsersResponse, error) {
	users, err := h.userService.SearchUsers(req.Query, req.Limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}

	resp := &proto.SearchUsersResponse{
		Users: make([]*proto.GetUserResponse, len(users)),
	}

	for i, user := range users {
		userResp := &proto.GetUserResponse{
			UserId: user.ID,
		}
		resp.Users[i] = userResp
	}

	return resp, nil
}

// CreateGroup creates a new group
func (h *PollisHandler) CreateGroup(ctx context.Context, req *proto.CreateGroupRequest) (*proto.CreateGroupResponse, error) {
	var description *string
	if req.Description != nil {
		description = req.Description
	}

	log.Printf("[CreateGroup] Creating group: group_id=%s, slug=%s, name=%s, created_by=%s", req.GroupId, req.Slug, req.Name, req.CreatedBy)
	err := h.groupService.CreateGroup(
		req.GroupId,
		req.Slug,
		req.Name,
		description,
		req.CreatedBy,
	)
	if err != nil {
		log.Printf("[CreateGroup] ERROR: Failed to create group %s: %v", req.GroupId, err)
		return &proto.CreateGroupResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to create group: %v", err),
		}, nil
	}

	log.Printf("[CreateGroup] SUCCESS: Group %s (slug: %s) created successfully", req.GroupId, req.Slug)
	return &proto.CreateGroupResponse{
		Success: true,
		GroupId: req.GroupId,
		Message: "Group created successfully",
	}, nil
}

// GetGroup retrieves a group by ID
func (h *PollisHandler) GetGroup(ctx context.Context, req *proto.GetGroupRequest) (*proto.GetGroupResponse, error) {
	group, members, err := h.groupService.GetGroup(req.GroupId)
	if err != nil {
		return nil, fmt.Errorf("failed to get group: %w", err)
	}

	resp := &proto.GetGroupResponse{
		GroupId:           group.ID,
		Slug:              group.Slug,
		Name:              group.Name,
		CreatedBy:         group.CreatedBy,
		MemberIdentifiers: members,
	}

	if group.Description != "" {
		resp.Description = &group.Description
	}

	return resp, nil
}

// SearchGroup searches for a group by slug
func (h *PollisHandler) SearchGroup(ctx context.Context, req *proto.SearchGroupRequest) (*proto.SearchGroupResponse, error) {
	group, members, isMember, err := h.groupService.SearchGroup(req.Slug, req.UserIdentifier)
	if err != nil {
		return &proto.SearchGroupResponse{
			IsMember: false,
		}, nil
	}

	resp := &proto.SearchGroupResponse{
		IsMember: isMember,
	}

	if isMember {
		groupResp := &proto.GetGroupResponse{
			GroupId:           group.ID,
			Slug:              group.Slug,
			Name:              group.Name,
			CreatedBy:         group.CreatedBy,
			MemberIdentifiers: members,
		}

		if group.Description != "" {
			groupResp.Description = &group.Description
		}

		resp.Group = groupResp
	}

	return resp, nil
}

// InviteToGroup invites a user to a group
func (h *PollisHandler) InviteToGroup(ctx context.Context, req *proto.InviteToGroupRequest) (*proto.InviteToGroupResponse, error) {
	err := h.groupService.InviteToGroup(req.GroupId, req.UserIdentifier, req.InvitedBy)
	if err != nil {
		return &proto.InviteToGroupResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to invite user: %v", err),
		}, nil
	}

	return &proto.InviteToGroupResponse{
		Success: true,
		Message: "User invited successfully",
	}, nil
}

// ListUserGroups lists all groups for a user
func (h *PollisHandler) ListUserGroups(ctx context.Context, req *proto.ListUserGroupsRequest) (*proto.ListUserGroupsResponse, error) {
	groups, memberLists, err := h.groupService.ListUserGroups(req.UserIdentifier)
	if err != nil {
		return nil, fmt.Errorf("failed to list user groups: %w", err)
	}

	resp := &proto.ListUserGroupsResponse{
		Groups: make([]*proto.GetGroupResponse, len(groups)),
	}

	for i, group := range groups {
		groupResp := &proto.GetGroupResponse{
			GroupId:           group.ID,
			Slug:              group.Slug,
			Name:              group.Name,
			CreatedBy:         group.CreatedBy,
			MemberIdentifiers: memberLists[i],
		}

		if group.Description != "" {
			groupResp.Description = &group.Description
		}

		resp.Groups[i] = groupResp
	}

	return resp, nil
}

// CreateChannel creates a new channel
func (h *PollisHandler) CreateChannel(ctx context.Context, req *proto.CreateChannelRequest) (*proto.CreateChannelResponse, error) {
	var description *string
	if req.Description != nil {
		description = req.Description
	}

	log.Printf("[CreateChannel] Creating channel: channel_id=%s, group_id=%s, slug=%s, name=%s, created_by=%s", req.ChannelId, req.GroupId, req.Slug, req.Name, req.CreatedBy)
	err := h.channelService.CreateChannel(
		req.ChannelId,
		req.GroupId,
		req.Slug,
		req.Name,
		description,
		req.CreatedBy,
	)
	if err != nil {
		log.Printf("[CreateChannel] ERROR: Failed to create channel %s: %v", req.ChannelId, err)
		return &proto.CreateChannelResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to create channel: %v", err),
		}, nil
	}

	log.Printf("[CreateChannel] SUCCESS: Channel %s (slug: %s) created successfully in group %s", req.ChannelId, req.Slug, req.GroupId)
	return &proto.CreateChannelResponse{
		Success:   true,
		ChannelId: req.ChannelId,
		Message:   "Channel created successfully",
	}, nil
}

// ListChannels lists all channels in a group
func (h *PollisHandler) ListChannels(ctx context.Context, req *proto.ListChannelsRequest) (*proto.ListChannelsResponse, error) {
	channels, err := h.channelService.ListChannels(req.GroupId)
	if err != nil {
		return nil, fmt.Errorf("failed to list channels: %w", err)
	}

	resp := &proto.ListChannelsResponse{
		Channels: make([]*proto.ChannelInfo, len(channels)),
	}

	for i, channel := range channels {
		channelInfo := &proto.ChannelInfo{
			ChannelId:   channel.ID,
			Slug:        channel.Slug,
			Name:        channel.Name,
			CreatedBy:   channel.CreatedBy,
			ChannelType: channel.ChannelType,
		}

		if channel.Description != "" {
			channelInfo.Description = &channel.Description
		}

		resp.Channels[i] = channelInfo
	}

	return resp, nil
}

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
