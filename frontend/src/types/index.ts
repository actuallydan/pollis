// Type definitions for Pollis app

export interface User {
  id: string; // ULID
  clerk_id: string; // Required, links to Clerk account
  // Note: identity keys are not exposed to frontend for security
  created_at: number;
  updated_at: number;
}

export interface Group {
  id: string; // ULID
  slug: string;
  name: string;
  description?: string;
  icon_url?: string; // R2 object key or public URL for group icon
  created_by: string; // user_id
  created_at: number;
  updated_at: number;
}

export interface GroupMember {
  id: string; // ULID
  group_id: string;
  user_identifier: string; // username/email/phone
  joined_at: number;
}

export interface Channel {
  id: string; // ULID
  group_id: string;
  slug?: string;
  name: string;
  description?: string;
  channel_type: string; // 'text' | 'voice'
  created_by: string; // user_id
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string; // ULID
  channel_id?: string; // NULL for direct messages
  conversation_id?: string; // ULID (required - channel or DM conversation)
  sender_id: string; // user_id (renamed from author_id per migration)
  ciphertext: Uint8Array; // encrypted content (renamed from content_encrypted)
  nonce: Uint8Array; // nonce for encryption
  content_decrypted?: string; // Decrypted content (client-side only)
  reply_to_message_id?: string; // ULID of message being replied to
  thread_id?: string; // ULID of thread root (NULL if not in thread)
  is_pinned: boolean;
  created_at: number; // primary timestamp
  delivered: boolean; // delivery status
  attachments?: MessageAttachment[];
  // UI state
  status?: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
}

export interface ReplyPreview {
  message_id: string;
  author_username: string;
  content_snippet: string;
  timestamp: number;
}

export interface DMConversation {
  id: string; // ULID (conversation_id)
  user1_id: string; // user_id
  user2_identifier: string; // username/email/phone of other user
  created_at: number;
  updated_at: number;
}

export interface MessageQueueItem {
  id: string; // ULID
  message_id: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  retry_count: number;
  created_at: number;
  updated_at: number;
}

export type NetworkStatus = 'online' | 'offline' | 'kill-switch';

export interface Profile {
  id: string; // Clerk user ID
  user_id: string; // Local User ID (links to users table)
  avatar_url?: string;
  last_used_at: number;
  created_at: number;
  biometric_enabled: boolean;
}

export interface PresignedUploadResponse {
  upload_url: string;
  object_key: string;
  public_url: string;
}

export interface MessageAttachment {
  id: string;
  object_key: string; // R2 object key
  filename: string;
  content_type: string;
  file_size: number;
  uploaded_at: number;
}

export interface UserAlias {
  id: string;
  user_id: string;
  group_id?: string; // If set, this alias is specific to a group
  name: string;
  avatar_url?: string;
  created_at: number;
  updated_at: number;
}

export interface AppState {
  // Current user
  currentUser: User | null;
  
  // Selected views
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  selectedConversationId: string | null; // For DMs
  
  // Data
  groups: Group[];
  channels: Record<string, Channel[]>; // group_id -> channels
  messages: Record<string, Message[]>; // channel_id or conversation_id -> messages
  dmConversations: DMConversation[];
  
  // Network
  networkStatus: NetworkStatus;
  killSwitchEnabled: boolean;
  
  // Message queue
  messageQueue: MessageQueueItem[];
  
  // UI state
  replyToMessageId: string | null;
  showThreadId: string | null;
  isLoading: boolean;
  error: string | null;
}

