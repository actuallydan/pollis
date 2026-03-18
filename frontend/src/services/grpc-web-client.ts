/**
 * HTTP JSON client for the Pollis service
 * Replaces the gRPC-web client with plain fetch() calls
 */

import type * as T from './grpc-types';

const SERVICE_URL = import.meta.env.VITE_SERVICE_URL || 'http://localhost:8081';

function uint8ArrayToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function apiRequest<TReq, TRes>(
  path: string,
  request: TReq,
  authToken?: string
): Promise<TRes> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${SERVICE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<TRes>;
}

export class ServiceClient {
  private authToken?: string;

  setAuthToken(token: string | undefined) {
    this.authToken = token;
  }

  async registerPreKeys(req: T.RegisterPreKeysRequest): Promise<T.RegisterPreKeysResponse> {
    return apiRequest('/v1/register-pre-keys', {
      ...req,
      identity_key: uint8ArrayToBase64(req.identity_key),
      signed_pre_key: uint8ArrayToBase64(req.signed_pre_key),
      signed_pre_key_sig: uint8ArrayToBase64(req.signed_pre_key_sig),
      one_time_pre_keys: req.one_time_pre_keys.map(uint8ArrayToBase64),
    }, this.authToken);
  }

  async getPreKeyBundle(req: T.GetPreKeyBundleRequest): Promise<T.GetPreKeyBundleResponse> {
    const res = await apiRequest<T.GetPreKeyBundleRequest, any>('/v1/get-pre-key-bundle', req, this.authToken);
    return {
      ...res,
      identity_key: res.identity_key ? base64ToUint8Array(res.identity_key) : new Uint8Array(),
      signed_pre_key: res.signed_pre_key ? base64ToUint8Array(res.signed_pre_key) : new Uint8Array(),
      signed_pre_key_sig: res.signed_pre_key_sig ? base64ToUint8Array(res.signed_pre_key_sig) : new Uint8Array(),
      one_time_pre_key: res.one_time_pre_key ? base64ToUint8Array(res.one_time_pre_key) : undefined,
    };
  }

  async rotateSignedPreKey(req: T.RotateSignedPreKeyRequest): Promise<T.RotateSignedPreKeyResponse> {
    return apiRequest('/v1/rotate-signed-pre-key', {
      ...req,
      signed_pre_key: uint8ArrayToBase64(req.signed_pre_key),
      signed_pre_key_sig: uint8ArrayToBase64(req.signed_pre_key_sig),
    }, this.authToken);
  }

  async getSenderKey(req: T.GetSenderKeyRequest): Promise<T.GetSenderKeyResponse> {
    const res = await apiRequest<T.GetSenderKeyRequest, any>('/v1/get-sender-key', req, this.authToken);
    return {
      ...res,
      sender_key: res.sender_key ? base64ToUint8Array(res.sender_key) : new Uint8Array(),
    };
  }

  async distributeSenderKey(req: T.DistributeSenderKeyRequest): Promise<T.DistributeSenderKeyResponse> {
    return apiRequest('/v1/distribute-sender-key', {
      ...req,
      sender_key: uint8ArrayToBase64(req.sender_key),
    }, this.authToken);
  }

  async sendKeyExchange(req: T.SendKeyExchangeRequest): Promise<T.SendKeyExchangeResponse> {
    return apiRequest('/v1/send-key-exchange', {
      ...req,
      encrypted_data: uint8ArrayToBase64(req.encrypted_data),
    }, this.authToken);
  }

  async getKeyExchangeMessages(req: T.GetKeyExchangeMessagesRequest): Promise<T.GetKeyExchangeMessagesResponse> {
    const res = await apiRequest<T.GetKeyExchangeMessagesRequest, any>('/v1/get-key-exchange-messages', req, this.authToken);
    return {
      messages: (res.messages || []).map((m: any) => ({
        ...m,
        encrypted_data: m.encrypted_data ? base64ToUint8Array(m.encrypted_data) : new Uint8Array(),
      })),
    };
  }

  async markKeyExchangeRead(req: T.MarkKeyExchangeReadRequest): Promise<T.MarkKeyExchangeReadResponse> {
    return apiRequest('/v1/mark-key-exchange-read', req, this.authToken);
  }

  async storeKeyBackup(req: T.StoreKeyBackupRequest): Promise<T.StoreKeyBackupResponse> {
    return apiRequest('/v1/store-key-backup', {
      ...req,
      encrypted_key: uint8ArrayToBase64(req.encrypted_key),
    }, this.authToken);
  }

  async getKeyBackup(req: T.GetKeyBackupRequest): Promise<T.GetKeyBackupResponse> {
    const res = await apiRequest<T.GetKeyBackupRequest, any>('/v1/get-key-backup', req, this.authToken);
    return {
      encrypted_key: res.encrypted_key ? base64ToUint8Array(res.encrypted_key) : new Uint8Array(),
    };
  }

  async deliverMessage(req: T.DeliverMessageRequest): Promise<T.DeliverMessageResponse> {
    return apiRequest('/v1/deliver-message', req, this.authToken);
  }

  async listUserGroups(req: T.ListUserGroupsRequest): Promise<T.ListUserGroupsResponse> {
    return apiRequest('/v1/list-user-groups', req, this.authToken);
  }

  async listChannels(req: T.ListChannelsRequest): Promise<T.ListChannelsResponse> {
    return apiRequest('/v1/list-channels', req, this.authToken);
  }

  async createGroup(req: T.CreateGroupRequest): Promise<T.CreateGroupResponse> {
    return apiRequest('/v1/create-group', req, this.authToken);
  }

  async createChannel(req: T.CreateChannelRequest): Promise<T.CreateChannelResponse> {
    return apiRequest('/v1/create-channel', req, this.authToken);
  }

  async searchGroup(req: T.SearchGroupRequest): Promise<T.SearchGroupResponse> {
    return apiRequest('/v1/search-group', req, this.authToken);
  }
}

export const grpcClient = new ServiceClient();
