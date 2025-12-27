/**
 * TypeScript types matching the gRPC proto definitions
 * These are used by both the Wails bindings and the gRPC-web client
 */

// User types
export interface RegisterUserRequest {
  user_id: string;
  username: string;
  email?: string;
  phone?: string;
  public_key: Uint8Array;
}

export interface RegisterUserResponse {
  success: boolean;
  message: string;
}

export interface GetUserRequest {
  user_identifier: string;
}

export interface GetUserResponse {
  user_id: string;
  username: string;
  email?: string;
  phone?: string;
  public_key: Uint8Array;
}

export interface SearchUsersRequest {
  query: string;
  limit: number;
}

export interface SearchUsersResponse {
  users: GetUserResponse[];
}

// Pre-Key types
export interface RegisterPreKeysRequest {
  user_id: string;
  identity_key: Uint8Array;
  signed_pre_key: Uint8Array;
  signed_pre_key_sig: Uint8Array;
  one_time_pre_keys: Uint8Array[];
}

export interface RegisterPreKeysResponse {
  success: boolean;
  message: string;
}

export interface GetPreKeyBundleRequest {
  user_identifier: string;
}

export interface GetPreKeyBundleResponse {
  user_id: string;
  identity_key: Uint8Array;
  signed_pre_key: Uint8Array;
  signed_pre_key_sig: Uint8Array;
  one_time_pre_key?: Uint8Array;
}

export interface RotateSignedPreKeyRequest {
  user_id: string;
  signed_pre_key: Uint8Array;
  signed_pre_key_sig: Uint8Array;
}

export interface RotateSignedPreKeyResponse {
  success: boolean;
  message: string;
}

// Group types
export interface CreateGroupRequest {
  group_id: string;
  slug: string;
  name: string;
  description?: string;
  created_by: string;
}

export interface CreateGroupResponse {
  success: boolean;
  group_id: string;
  message: string;
}

export interface GetGroupRequest {
  group_id: string;
}

export interface GetGroupResponse {
  group_id: string;
  slug: string;
  name: string;
  description?: string;
  created_by: string;
  member_identifiers: string[];
}

export interface SearchGroupRequest {
  slug: string;
  user_identifier: string;
}

export interface SearchGroupResponse {
  group?: GetGroupResponse;
  is_member: boolean;
}

export interface InviteToGroupRequest {
  group_id: string;
  user_identifier: string;
  invited_by: string;
}

export interface InviteToGroupResponse {
  success: boolean;
  message: string;
}

export interface ListUserGroupsRequest {
  user_identifier: string;
}

export interface ListUserGroupsResponse {
  groups: GetGroupResponse[];
}

// Channel types
export interface CreateChannelRequest {
  channel_id: string;
  group_id: string;
  slug: string;
  name: string;
  description?: string;
  created_by: string;
}

export interface CreateChannelResponse {
  success: boolean;
  channel_id: string;
  message: string;
}

export interface ListChannelsRequest {
  group_id: string;
}

export interface ChannelInfo {
  channel_id: string;
  slug: string;
  name: string;
  description?: string;
  created_by: string;
  channel_type: string;
}

export interface ListChannelsResponse {
  channels: ChannelInfo[];
}

// Sender Key types
export interface GetSenderKeyRequest {
  group_id: string;
  channel_id: string;
}

export interface GetSenderKeyResponse {
  success: boolean;
  sender_key: Uint8Array;
  key_version: number;
  created_at: number;
}

export interface DistributeSenderKeyRequest {
  group_id: string;
  channel_id: string;
  sender_key: Uint8Array;
  key_version: number;
  recipient_identifiers: string[];
}

export interface DistributeSenderKeyResponse {
  success: boolean;
  message: string;
}

// Key Exchange types
export interface SendKeyExchangeRequest {
  from_user_id: string;
  to_user_identifier: string;
  message_type: string;
  encrypted_data: Uint8Array;
  expires_in_seconds: number;
}

export interface SendKeyExchangeResponse {
  success: boolean;
  message_id: string;
  message: string;
}

export interface GetKeyExchangeMessagesRequest {
  user_identifier: string;
}

export interface KeyExchangeMessage {
  message_id: string;
  from_user_id: string;
  message_type: string;
  encrypted_data: Uint8Array;
  created_at: number;
}

export interface GetKeyExchangeMessagesResponse {
  messages: KeyExchangeMessage[];
}

export interface MarkKeyExchangeReadRequest {
  message_ids: string[];
}

export interface MarkKeyExchangeReadResponse {
  success: boolean;
}

// Key Backup types
export interface StoreKeyBackupRequest {
  user_id: string;
  encrypted_key: Uint8Array;
}

export interface StoreKeyBackupResponse {
  success: boolean;
  message: string;
}

export interface GetKeyBackupRequest {
  user_id: string;
}

export interface GetKeyBackupResponse {
  encrypted_key: Uint8Array;
}

// Message Delivery types
export interface DeliverMessageRequest {
  channel_id?: string;
  conversation_id?: string;
  message_id: string;
  sender_id: string;
  created_at: number;
}

export interface DeliverMessageResponse {
  success: boolean;
  message: string;
}

