/**
 * gRPC-web client for connecting to the Pollis service from web browsers
 * Uses the grpc-web protocol over HTTP
 */

import type * as T from './grpc-types';

// Get service URL from environment or default to localhost
const SERVICE_URL = import.meta.env.VITE_SERVICE_URL || 'http://localhost:8081';

// Helper to convert Uint8Array to base64 for JSON transport
function uint8ArrayToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generic request helper for grpc-web over HTTP
async function grpcRequest<TReq, TRes>(
  method: string,
  request: TReq,
  authToken?: string
): Promise<TRes> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/grpc-web-text',
    'Accept': 'application/grpc-web-text',
    'X-Grpc-Web': '1',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // For grpc-web, we need to encode the request properly
  // This is a simplified version - in production you'd want to use the full grpc-web protocol
  const response = await fetch(`${SERVICE_URL}/pollis.PollisService/${method}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`gRPC error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data as TRes;
}

/**
 * gRPC-web client for the Pollis service
 */
export class GrpcWebClient {
  private authToken?: string;

  setAuthToken(token: string | undefined) {
    this.authToken = token;
  }

  // User Management
  async registerUser(req: T.RegisterUserRequest): Promise<T.RegisterUserResponse> {
    return grpcRequest('RegisterUser', {
      ...req,
      public_key: uint8ArrayToBase64(req.public_key),
    }, this.authToken);
  }

  async getUser(req: T.GetUserRequest): Promise<T.GetUserResponse> {
    const res = await grpcRequest<T.GetUserRequest, any>('GetUser', req, this.authToken);
    return {
      ...res,
      public_key: res.public_key ? base64ToUint8Array(res.public_key) : new Uint8Array(),
    };
  }

  async searchUsers(req: T.SearchUsersRequest): Promise<T.SearchUsersResponse> {
    const res = await grpcRequest<T.SearchUsersRequest, any>('SearchUsers', req, this.authToken);
    return {
      users: (res.users || []).map((u: any) => ({
        ...u,
        public_key: u.public_key ? base64ToUint8Array(u.public_key) : new Uint8Array(),
      })),
    };
  }

  // Pre-Key Management
  async registerPreKeys(req: T.RegisterPreKeysRequest): Promise<T.RegisterPreKeysResponse> {
    return grpcRequest('RegisterPreKeys', {
      ...req,
      identity_key: uint8ArrayToBase64(req.identity_key),
      signed_pre_key: uint8ArrayToBase64(req.signed_pre_key),
      signed_pre_key_sig: uint8ArrayToBase64(req.signed_pre_key_sig),
      one_time_pre_keys: req.one_time_pre_keys.map(uint8ArrayToBase64),
    }, this.authToken);
  }

  async getPreKeyBundle(req: T.GetPreKeyBundleRequest): Promise<T.GetPreKeyBundleResponse> {
    const res = await grpcRequest<T.GetPreKeyBundleRequest, any>('GetPreKeyBundle', req, this.authToken);
    return {
      ...res,
      identity_key: res.identity_key ? base64ToUint8Array(res.identity_key) : new Uint8Array(),
      signed_pre_key: res.signed_pre_key ? base64ToUint8Array(res.signed_pre_key) : new Uint8Array(),
      signed_pre_key_sig: res.signed_pre_key_sig ? base64ToUint8Array(res.signed_pre_key_sig) : new Uint8Array(),
      one_time_pre_key: res.one_time_pre_key ? base64ToUint8Array(res.one_time_pre_key) : undefined,
    };
  }

  async rotateSignedPreKey(req: T.RotateSignedPreKeyRequest): Promise<T.RotateSignedPreKeyResponse> {
    return grpcRequest('RotateSignedPreKey', {
      ...req,
      signed_pre_key: uint8ArrayToBase64(req.signed_pre_key),
      signed_pre_key_sig: uint8ArrayToBase64(req.signed_pre_key_sig),
    }, this.authToken);
  }

  // Group Management
  async createGroup(req: T.CreateGroupRequest): Promise<T.CreateGroupResponse> {
    return grpcRequest('CreateGroup', req, this.authToken);
  }

  async getGroup(req: T.GetGroupRequest): Promise<T.GetGroupResponse> {
    return grpcRequest('GetGroup', req, this.authToken);
  }

  async searchGroup(req: T.SearchGroupRequest): Promise<T.SearchGroupResponse> {
    return grpcRequest('SearchGroup', req, this.authToken);
  }

  async inviteToGroup(req: T.InviteToGroupRequest): Promise<T.InviteToGroupResponse> {
    return grpcRequest('InviteToGroup', req, this.authToken);
  }

  async listUserGroups(req: T.ListUserGroupsRequest): Promise<T.ListUserGroupsResponse> {
    return grpcRequest('ListUserGroups', req, this.authToken);
  }

  // Channel Management
  async createChannel(req: T.CreateChannelRequest): Promise<T.CreateChannelResponse> {
    return grpcRequest('CreateChannel', req, this.authToken);
  }

  async listChannels(req: T.ListChannelsRequest): Promise<T.ListChannelsResponse> {
    return grpcRequest('ListChannels', req, this.authToken);
  }

  // Sender Key Management
  async getSenderKey(req: T.GetSenderKeyRequest): Promise<T.GetSenderKeyResponse> {
    const res = await grpcRequest<T.GetSenderKeyRequest, any>('GetSenderKey', req, this.authToken);
    return {
      ...res,
      sender_key: res.sender_key ? base64ToUint8Array(res.sender_key) : new Uint8Array(),
    };
  }

  async distributeSenderKey(req: T.DistributeSenderKeyRequest): Promise<T.DistributeSenderKeyResponse> {
    return grpcRequest('DistributeSenderKey', {
      ...req,
      sender_key: uint8ArrayToBase64(req.sender_key),
    }, this.authToken);
  }

  // Key Exchange
  async sendKeyExchange(req: T.SendKeyExchangeRequest): Promise<T.SendKeyExchangeResponse> {
    return grpcRequest('SendKeyExchange', {
      ...req,
      encrypted_data: uint8ArrayToBase64(req.encrypted_data),
    }, this.authToken);
  }

  async getKeyExchangeMessages(req: T.GetKeyExchangeMessagesRequest): Promise<T.GetKeyExchangeMessagesResponse> {
    const res = await grpcRequest<T.GetKeyExchangeMessagesRequest, any>('GetKeyExchangeMessages', req, this.authToken);
    return {
      messages: (res.messages || []).map((m: any) => ({
        ...m,
        encrypted_data: m.encrypted_data ? base64ToUint8Array(m.encrypted_data) : new Uint8Array(),
      })),
    };
  }

  async markKeyExchangeRead(req: T.MarkKeyExchangeReadRequest): Promise<T.MarkKeyExchangeReadResponse> {
    return grpcRequest('MarkKeyExchangeRead', req, this.authToken);
  }

  // Key Backup
  async storeKeyBackup(req: T.StoreKeyBackupRequest): Promise<T.StoreKeyBackupResponse> {
    return grpcRequest('StoreKeyBackup', {
      ...req,
      encrypted_key: uint8ArrayToBase64(req.encrypted_key),
    }, this.authToken);
  }

  async getKeyBackup(req: T.GetKeyBackupRequest): Promise<T.GetKeyBackupResponse> {
    const res = await grpcRequest<T.GetKeyBackupRequest, any>('GetKeyBackup', req, this.authToken);
    return {
      encrypted_key: res.encrypted_key ? base64ToUint8Array(res.encrypted_key) : new Uint8Array(),
    };
  }

  // Message Delivery
  async deliverMessage(req: T.DeliverMessageRequest): Promise<T.DeliverMessageResponse> {
    return grpcRequest('DeliverMessage', req, this.authToken);
  }
}

// Singleton instance
export const grpcClient = new GrpcWebClient();

