import { invoke } from '@tauri-apps/api/core';
import type { PresignedUploadResponse } from '../types';

export async function uploadAvatar(
  userId: string,
  _aliasId: string,
  file: File,
): Promise<PresignedUploadResponse> {
  const data = new Uint8Array(await file.arrayBuffer());
  const key = `avatars/${userId}/${Date.now()}-${file.name}`;
  const result = await invoke<{ key: string; url: string }>('upload_file', {
    key,
    data: Array.from(data),
    contentType: file.type || 'image/png',
  });
  return { upload_url: '', object_key: result.key, public_url: result.url };
}

export async function uploadGroupIcon(
  groupId: string,
  file: File,
): Promise<PresignedUploadResponse> {
  const data = new Uint8Array(await file.arrayBuffer());
  const key = `group-icons/${groupId}/${Date.now()}-${file.name}`;
  const result = await invoke<{ key: string; url: string }>('upload_file', {
    key,
    data: Array.from(data),
    contentType: file.type || 'image/png',
  });
  return { upload_url: '', object_key: result.key, public_url: result.url };
}

export async function uploadFileAttachment(
  channelId: string | null,
  conversationId: string | null,
  messageId: string | null,
  file: File,
  _onProgress?: (progress: number) => void,
): Promise<PresignedUploadResponse> {
  const data = new Uint8Array(await file.arrayBuffer());
  const prefix = channelId ? `channels/${channelId}` : `conversations/${conversationId}`;
  const key = `${prefix}/${messageId || Date.now()}/${file.name}`;
  const result = await invoke<{ key: string; url: string }>('upload_file', {
    key,
    data: Array.from(data),
    contentType: file.type || 'application/octet-stream',
  });
  return { upload_url: '', object_key: result.key, public_url: result.url };
}

export async function getFileDownloadUrl(objectKey: string): Promise<string> {
  const bytes = await invoke<number[]>('download_file', { key: objectKey });
  const blob = new Blob([new Uint8Array(bytes)]);
  return URL.createObjectURL(blob);
}
