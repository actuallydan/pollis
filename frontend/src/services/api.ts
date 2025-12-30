/**
 * Unified API service that works on both desktop (Wails) and web (gRPC-web)
 * This abstraction layer provides a consistent interface regardless of platform
 */

import { checkIsDesktop } from '../hooks/useWailsReady';
import { grpcClient } from './grpc-web-client';
import * as webStorage from './web-storage';
import type { User, Group, Channel, Message, DMConversation } from '../types';

// Type for platform detection
let _isDesktop: boolean | null = null;

function isDesktop(): boolean {
  if (_isDesktop === null) {
    _isDesktop = checkIsDesktop();
  }
  return _isDesktop;
}

/**
 * Guard function to ensure Wails runtime is fully initialized before API calls
 * Prevents race conditions where React tries to call APIs before runtime is ready
 */
function ensureWailsRuntimeReady(): void {
  if (!isDesktop()) return;

  const win = window as any;
  if (
    typeof win.go === 'undefined' ||
    typeof win.go.main === 'undefined' ||
    typeof win.go.main.App === 'undefined' ||
    typeof win.runtime === 'undefined' ||
    typeof win.runtime.EventsOnMultiple === 'undefined'
  ) {
    throw new Error('Wails runtime not fully initialized - please wait for wails:ready event');
  }
}

/**
 * Get stored session (userID and clerkToken)
 */
export async function getStoredSession(): Promise<{ userID: string; clerkToken: string } | null> {
  if (isDesktop()) {
    ensureWailsRuntimeReady();
    const { GetStoredSession } = await import('../../wailsjs/go/main/App');
    try {
      const session = await GetStoredSession();
      // Backend now returns a map[string]string
      if (!session) return null;
      if (typeof session === 'object' && session !== null) {
        const sessionObj = session as { userID?: string; clerkToken?: string };
        if (sessionObj.userID && sessionObj.clerkToken) {
          return {
            userID: sessionObj.userID,
            clerkToken: sessionObj.clerkToken,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('[api] Error getting stored session:', error);
      return null;
    }
  }
  
  // Web: Get from IndexedDB (not used in desktop-only app)
  return null;
}

/**
 * Store session (userID and clerkToken)
 */
export async function storeSession(userID: string, clerkToken: string): Promise<void> {
  if (isDesktop()) {
    const { StoreSession } = await import('../../wailsjs/go/main/App');
    return StoreSession(userID, clerkToken);
  }
  
  // Web: Store in IndexedDB
  await webStorage.storeSession(userID, clerkToken);
}

/**
 * Clear stored session
 */
export async function clearSession(): Promise<void> {
  if (isDesktop()) {
    const { ClearSession } = await import('../../wailsjs/go/main/App');
    return ClearSession();
  }
  
  // Web: Clear from IndexedDB
  await webStorage.clearSession();
}

/**
 * Authenticate with Clerk and load/create User
 */
export async function authenticateAndLoadUser(clerkToken: string): Promise<User> {
  if (isDesktop()) {
    ensureWailsRuntimeReady();
    const { AuthenticateAndLoadUser } = await import('../../wailsjs/go/main/App');
    const user = await AuthenticateAndLoadUser(clerkToken);
    return {
      id: user.id,
      clerk_id: user.clerk_id,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
  
  // Web: Verify token with Clerk, query service for User, create if needed
  // For now, we'll need to implement this with gRPC-web
  // This is a placeholder - actual implementation depends on service RPC
  throw new Error('Web implementation of authenticateAndLoadUser not yet implemented');
}

/**
 * Check if user has an identity (Signal keys)
 * Note: Identity is now created automatically during authentication
 */
export async function checkIdentity(): Promise<boolean> {
  if (isDesktop()) {
    const { CheckIdentity } = await import('../../wailsjs/go/main/App');
    return CheckIdentity();
  }
  
  // Web: Check IndexedDB for identity
  const identity = await webStorage.get(webStorage.STORES.IDENTITY, 'current');
  return !!identity;
}

/**
 * Get current user data
 */
export async function getCurrentUser(): Promise<User | null> {
  if (isDesktop()) {
    ensureWailsRuntimeReady();
    const { GetCurrentUser } = await import('../../wailsjs/go/main/App');
    const user = await GetCurrentUser();
    if (!user) return null;
    return {
      id: user.id,
      clerk_id: user.clerk_id,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
  
  // Web: Get from IndexedDB
  const user = await webStorage.get<User>(webStorage.STORES.USERS, 'current');
  return user || null;
}

/**
 * Get user data (username, email, phone, avatar_url) from service DB
 */
export async function getServiceUserData(): Promise<{ username: string; email: string; phone: string; avatar_url?: string }> {
  if (isDesktop()) {
    const { GetServiceUserData } = await import('../../wailsjs/go/main/App');
    const data = await GetServiceUserData();
    return {
      username: (data.username as string) || "",
      email: (data.email as string) || "",
      phone: (data.phone as string) || "",
      avatar_url: (data.avatar_url as string) || undefined,
    };
  }
  
  // Web: Not available
  throw new Error("Service user data only available in desktop app");
}

/**
 * Update user data (username, email, phone) in service DB
 */
export async function updateServiceUserData(
  username: string,
  email: string | null,
  phone: string | null
): Promise<void> {
  if (isDesktop()) {
    const { UpdateServiceUserData } = await import('../../wailsjs/go/main/App');
    await UpdateServiceUserData(username, email, phone, null);
    return;
  }

  // Web: Not available
  throw new Error("Service user data updates only available in desktop app");
}

/**
 * Update user avatar URL in service DB
 */
export async function updateServiceUserAvatar(avatarURL: string): Promise<void> {
  if (isDesktop()) {
    try {
      const appModule = await import('../../wailsjs/go/main/App');
      // Check if UpdateServiceUserAvatar exists (may need to regenerate Wails bindings)
      if (!('UpdateServiceUserAvatar' in appModule)) {
        throw new Error("UpdateServiceUserAvatar not found - regenerate Wails bindings with 'wails generate'");
      }
      const { UpdateServiceUserAvatar } = appModule;
      await UpdateServiceUserAvatar(avatarURL);
      return;
    } catch (error) {
      console.error("Failed to update service user avatar:", error);
      throw error;
    }
  }
  
  // Web: Not available
  throw new Error("Service user avatar updates only available in desktop app");
}

/**
 * Logout user (optionally delete local data)
 */
export async function logout(deleteData: boolean = false): Promise<void> {
  if (isDesktop()) {
    const { Logout } = await import('../../wailsjs/go/main/App');
    return Logout(deleteData);
  }
  
  // Web: Clear session and optionally clear IndexedDB
  await clearSession();
  if (deleteData) {
    await webStorage.deleteDB();
  }
}

/**
 * List user's groups
 */
export async function listUserGroups(userId: string): Promise<Group[]> {
  if (isDesktop()) {
    const { ListUserGroups } = await import('../../wailsjs/go/main/App');
    const groups = await ListUserGroups(userId);
    return (groups || []).map((g: any) => ({
      id: g.id,
      slug: g.slug || '',
      name: g.name,
      description: g.description || '',
      created_by: g.created_by,
      created_at: g.created_at || 0,
      updated_at: g.updated_at || 0,
    }));
  }
  
  // Web: Get from service and cache locally
  const response = await grpcClient.listUserGroups({ user_identifier: userId });
  const groups: Group[] = response.groups.map(g => ({
    id: g.group_id,
    slug: g.slug,
    name: g.name,
    description: g.description || '',
    created_by: g.created_by,
    created_at: 0,
    updated_at: 0,
  }));
  
  // Cache locally
  for (const group of groups) {
    await webStorage.put(webStorage.STORES.GROUPS, group);
  }
  
  return groups;
}

/**
 * List channels in a group
 */
export async function listChannels(groupId: string): Promise<Channel[]> {
  if (isDesktop()) {
    const { ListChannels } = await import('../../wailsjs/go/main/App');
    const channels = await ListChannels(groupId);
    return (channels || []).map((c: any) => ({
      id: c.id,
      group_id: c.group_id,
      slug: c.slug || '',
      name: c.name,
      description: c.description || '',
      channel_type: c.channel_type || 'text',
      created_by: c.created_by,
      created_at: c.created_at || 0,
      updated_at: c.updated_at || 0,
    }));
  }
  
  // Web: Get from service and cache locally
  const response = await grpcClient.listChannels({ group_id: groupId });
  const channels: Channel[] = response.channels.map(c => ({
    id: c.channel_id,
    group_id: groupId,
    slug: c.slug,
    name: c.name,
    description: c.description || '',
    channel_type: c.channel_type || 'text',
    created_by: c.created_by,
    created_at: 0,
    updated_at: 0,
  }));
  
  // Cache locally
  for (const channel of channels) {
    await webStorage.put(webStorage.STORES.CHANNELS, channel);
  }
  
  return channels;
}

/**
 * List DM conversations
 */
export async function listDMConversations(userId: string): Promise<DMConversation[]> {
  if (isDesktop()) {
    const { ListDMConversations } = await import('../../wailsjs/go/main/App');
    const conversations = await ListDMConversations(userId);
    return (conversations || []).map((c: any) => ({
      id: c.id,
      user1_id: c.user1_id,
      user2_identifier: c.user2_identifier,
      created_at: c.created_at || 0,
      updated_at: c.updated_at || 0,
    }));
  }
  
  // Web: Get from local storage (DMs are stored locally)
  return webStorage.getAllByIndex<DMConversation>(
    webStorage.STORES.DM_CONVERSATIONS,
    'user1_id',
    userId
  );
}

/**
 * Get messages for a channel
 */
export async function listMessages(channelId: string, conversationId?: string): Promise<Message[]> {
  if (isDesktop()) {
    const { GetMessages } = await import('../../wailsjs/go/main/App');
    const messages = await GetMessages(channelId, conversationId || '', 100, 0);
    return (messages || []).map((m: any) => ({
      id: m.id,
      channel_id: m.channel_id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      ciphertext: new Uint8Array(),
      nonce: new Uint8Array(),
      content_decrypted: m.content || '',
      reply_to_message_id: m.reply_to_message_id,
      thread_id: m.thread_id,
      is_pinned: m.is_pinned || false,
      created_at: m.created_at || 0,
      delivered: m.delivered || false,
      status: 'sent' as const,
    }));
  }
  
  // Web: Get from local storage
  const messages = await webStorage.getAllByIndex<any>(
    webStorage.STORES.MESSAGES,
    'channel_id',
    channelId
  );
  return messages.map((m: any) => ({
    id: m.id,
    channel_id: m.channel_id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    ciphertext: m.ciphertext || new Uint8Array(),
    nonce: m.nonce || new Uint8Array(),
    content_decrypted: m.content_decrypted || '',
    reply_to_message_id: m.reply_to_message_id,
    thread_id: m.thread_id,
    is_pinned: m.is_pinned || false,
    created_at: m.created_at || 0,
    delivered: m.delivered || false,
    status: m.status || 'sent',
  }));
}

/**
 * Send a message
 */
export async function sendMessage(channelId: string, conversationId: string, content: string, replyToId?: string): Promise<Message> {
  if (isDesktop()) {
    const { SendMessage } = await import('../../wailsjs/go/main/App');
    const msg = await SendMessage(channelId, conversationId, content, replyToId || '', '');
    return {
      id: msg.id,
      channel_id: msg.channel_id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      ciphertext: new Uint8Array(),
      nonce: new Uint8Array(),
      content_decrypted: msg.content || content,
      reply_to_message_id: msg.reply_to_message_id,
      thread_id: msg.thread_id,
      is_pinned: msg.is_pinned || false,
      created_at: msg.created_at || Date.now(),
      delivered: msg.delivered || false,
      status: 'sent' as const,
    };
  }
  
  // Web: Create message locally and notify service
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No user logged in');
  }
  
  const messageId = crypto.randomUUID();
  const timestamp = Date.now();
  const message: Message = {
    id: messageId,
    channel_id: channelId || undefined,
    conversation_id: conversationId || undefined,
    sender_id: user.id,
    ciphertext: new Uint8Array(),
    nonce: new Uint8Array(),
    content_decrypted: content,
    reply_to_message_id: replyToId,
    is_pinned: false,
    created_at: timestamp,
    delivered: false,
    status: 'sent' as const,
  };
  
  // Store locally
  await webStorage.put(webStorage.STORES.MESSAGES, message);
  
  // Notify service (for real-time delivery to other users)
  await grpcClient.deliverMessage({
    channel_id: channelId || undefined,
    conversation_id: conversationId || undefined,
    message_id: messageId,
    sender_id: user.id,
    created_at: timestamp,
  });
  
  return message;
}

/**
 * Create a new group
 */
export async function createGroup(name: string, description: string): Promise<Group> {
  if (isDesktop()) {
    const { CreateGroup, GetCurrentUser } = await import('../../wailsjs/go/main/App');
    const user = await GetCurrentUser();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const group = await CreateGroup(name, description, slug, user.id);
    return {
      id: group.id,
      slug: group.slug || slug,
      name: group.name,
      description: group.description || '',
      created_by: group.created_by,
      created_at: group.created_at || Date.now(),
      updated_at: group.updated_at || Date.now(),
    };
  }
  
  // Web: Create via service
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No user logged in');
  }
  
  const groupId = crypto.randomUUID();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  await grpcClient.createGroup({
    group_id: groupId,
    slug,
    name,
    description,
    created_by: user.id,
  });
  
  const group: Group = {
    id: groupId,
    slug,
    name,
    description,
    created_by: user.id,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  
  await webStorage.put(webStorage.STORES.GROUPS, group);
  return group;
}

/**
 * Create a new channel
 */
export async function createChannel(groupId: string, name: string, description: string): Promise<Channel> {
  if (isDesktop()) {
    const { CreateChannel, GetCurrentUser } = await import('../../wailsjs/go/main/App');
    const user = await GetCurrentUser();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const channel = await CreateChannel(groupId, name, description, slug, user.id);
    return {
      id: channel.id,
      group_id: channel.group_id,
      slug: channel.slug || slug,
      name: channel.name,
      description: channel.description || '',
      channel_type: channel.channel_type || 'text',
      created_by: channel.created_by,
      created_at: channel.created_at || Date.now(),
      updated_at: channel.updated_at || Date.now(),
    };
  }
  
  // Web: Create via service
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No user logged in');
  }
  
  const channelId = crypto.randomUUID();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  await grpcClient.createChannel({
    channel_id: channelId,
    group_id: groupId,
    slug,
    name,
    description,
    created_by: user.id,
  });
  
  const channel: Channel = {
    id: channelId,
    group_id: groupId,
    slug,
    name,
    description,
    channel_type: 'text',
    created_by: user.id,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  
  await webStorage.put(webStorage.STORES.CHANNELS, channel);
  return channel;
}

/**
 * Search for a group by slug
 */
export async function searchGroup(slug: string): Promise<{ group: Group | null; isMember: boolean }> {
  if (isDesktop()) {
    const { SearchGroup, ListUserGroups, GetCurrentUser } = await import('../../wailsjs/go/main/App');
    try {
      const result = await SearchGroup(slug);
      if (!result || !result.id) {
        return { group: null, isMember: false };
      }
      
      const group: Group = {
        id: result.id,
        slug: result.slug || '',
        name: result.name,
        description: result.description || '',
        created_by: result.created_by,
        created_at: result.created_at || 0,
        updated_at: result.updated_at || 0,
      };
      
      // Check if user is a member by checking their groups
      const user = await GetCurrentUser();
      const userGroups = await ListUserGroups(user.id);
      const isMember = (userGroups || []).some((g: any) => g.id === result.id);
      
      return { group, isMember };
    } catch (error) {
      return { group: null, isMember: false };
    }
  }
  
  // Web: Search via service
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No user logged in');
  }
  
  const response = await grpcClient.searchGroup({
    slug,
    user_identifier: user.id,
  });
  
  if (!response.group) {
    return { group: null, isMember: false };
  }
  
  const group: Group = {
    id: response.group.group_id,
    slug: response.group.slug,
    name: response.group.name,
    description: response.group.description || '',
    created_by: response.group.created_by,
    created_at: 0,
    updated_at: 0,
  };
  
  return { group, isMember: response.is_member };
}

/**
 * Join a group
 */
export async function joinGroup(groupId: string): Promise<void> {
  if (isDesktop()) {
    const { AddGroupMember } = await import('../../wailsjs/go/main/App');
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }
    return AddGroupMember(groupId, user.id);
  }
  
  // Web: This would require an invite flow
  // For now, not implemented
  console.warn('Join group not yet implemented for web');
}

/**
 * Update group information
 */
export async function updateGroup(groupId: string, name: string, description: string): Promise<Group> {
  if (isDesktop()) {
    try {
      const appModule = await import('../../wailsjs/go/main/App');
      // Check if UpdateGroup exists (may need to regenerate Wails bindings)
      if (!('UpdateGroup' in appModule)) {
        throw new Error("UpdateGroup not found - regenerate Wails bindings with 'wails generate'");
      }
      const { UpdateGroup } = appModule;
      const group = await UpdateGroup(groupId, name, description);
      return {
        id: group.id,
        slug: group.slug || '',
        name: group.name,
        description: group.description || '',
        created_by: group.created_by,
        created_at: group.created_at || 0,
        updated_at: group.updated_at || 0,
      };
    } catch (error) {
      console.error("Failed to update group:", error);
      throw error;
    }
  }
  
  // Web: Not implemented
  throw new Error("Group updates only available in desktop app");
}

/**
 * Get network status
 */
export async function setServiceURL(url: string): Promise<void> {
  if (isDesktop()) {
    ensureWailsRuntimeReady();
    const { SetServiceURL } = await import('../../wailsjs/go/main/App');
    await SetServiceURL(url);
  }
  // Web: No-op (uses gRPC-web client directly)
}

export async function getNetworkStatus(): Promise<'online' | 'offline' | 'kill-switch'> {
  if (isDesktop()) {
    const { GetNetworkStatus } = await import('../../wailsjs/go/main/App');
    const status = await GetNetworkStatus();
    // Ensure valid status
    if (status === 'online' || status === 'offline' || status === 'kill-switch') {
      return status;
    }
    return navigator.onLine ? 'online' : 'offline';
  }
  
  // Web: Check if online
  return navigator.onLine ? 'online' : 'offline';
}

/**
 * Start desktop authentication flow
 * This should ONLY be called from the desktop app
 */
export async function authenticateWithClerk(): Promise<string> {
  if (!isDesktop()) {
    // This should never be called from browser - if it is, it's a bug
    console.error('authenticateWithClerk called from browser - this should not happen');
    throw new Error('This function can only be called from the desktop app');
  }
  
  const { AuthenticateWithClerk } = await import('../../wailsjs/go/main/App');
  return AuthenticateWithClerk();
}

/**
 * Cancel authentication flow
 */
export async function cancelAuth(): Promise<void> {
  if (isDesktop()) {
    const { CancelAuth } = await import('../../wailsjs/go/main/App');
    return CancelAuth();
  }
  
  // Web: Nothing to cancel
}
