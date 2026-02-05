import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { useAppStore } from '../stores/appStore';
import { useWailsReady } from './useWailsReady';
import { messageQueryKeys } from './queries/useMessages';

// Ably event types (extensible for future events)
type AblyEventType = 'message' | 'channel_created' | 'group_invitation' | 'user_typing' | 'presence';

interface AblyMessageEvent {
  message_id: string;
  channel_id?: string;
  conversation_id?: string;
  author_id: string;
  timestamp: number;
}

// Message batching configuration
const BATCH_CONFIG = {
  WINDOW_MS: 100, // Batch messages within 100ms
  MAX_BATCH_SIZE: 50, // Flush if batch reaches 50 messages
  DEDUPE_TTL: 60000, // Keep processed message IDs for 1 minute
} as const;

/**
 * Hook for managing Ably real-time subscriptions
 *
 * Features:
 * - Automatic subscription management based on selected channel/conversation
 * - Debounced cache invalidation for performance
 * - Deduplication to prevent duplicate messages
 * - Extensible for future event types
 *
 * Architecture:
 * - React Query is single source of truth for messages
 * - Desktop Go backend is a simple pass-through to Ably
 * - Events flow: Ably → Go Backend → Wails IPC → React Query invalidation
 */
export function useAblyRealtime() {
  const { isDesktop, isReady: isWailsReady } = useWailsReady();
  const queryClient = useQueryClient();
  const {
    selectedChannelId,
    selectedConversationId,
    currentUser,
    networkStatus,
  } = useAppStore();

  // Track current subscription
  const currentSubscriptionRef = useRef<string | null>(null);

  // Debounce timer for invalidation
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deduplication: track processed message IDs
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const dedupeCleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get the active channel/conversation ID
  const activeChannelId = selectedChannelId || selectedConversationId || null;

  /**
   * Invalidate React Query cache for messages with debouncing
   * Groups rapid invalidations into a single refetch
   */
  const invalidateMessages = useCallback((channelId: string | null, conversationId: string | null) => {
    // Clear existing timer
    if (invalidateTimerRef.current) {
      clearTimeout(invalidateTimerRef.current);
    }

    // Debounce invalidation by 100ms to batch rapid updates
    invalidateTimerRef.current = setTimeout(() => {
      if (channelId) {
        queryClient.invalidateQueries({
          queryKey: messageQueryKeys.channel(channelId),
        });
      } else if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: messageQueryKeys.conversation(conversationId),
        });
      }
    }, BATCH_CONFIG.WINDOW_MS);
  }, [queryClient]);

  /**
   * Clean up old deduplication IDs periodically
   */
  const cleanupDedupeIds = useCallback(() => {
    // Clear old IDs if set gets too large
    if (processedMessageIdsRef.current.size > 10000) {
      processedMessageIdsRef.current.clear();
    }
  }, []);

  /**
   * Handle incoming Ably message event
   * Instead of fetching and storing messages directly, we invalidate React Query cache
   * to trigger a refetch - keeping React Query as the single source of truth
   */
  const handleAblyMessage = useCallback((eventData: any) => {
    console.log('[Ably] Received message event:', eventData);
    const data = eventData as AblyMessageEvent;

    // Normalize field names - server sends sender_id/created_at, we expect author_id/timestamp
    const normalizedData = {
      ...data,
      author_id: (data as any).sender_id || data.author_id,
      timestamp: (data as any).created_at || data.timestamp,
    };

    // Validate required fields
    if (!normalizedData.message_id || !normalizedData.author_id || !normalizedData.timestamp) {
      console.warn('[Ably] Invalid message event:', normalizedData);
      return;
    }

    // Deduplication check
    if (processedMessageIdsRef.current.has(normalizedData.message_id)) {
      console.log('[Ably] Duplicate message, skipping:', normalizedData.message_id);
      return;
    }
    processedMessageIdsRef.current.add(normalizedData.message_id);

    // Don't invalidate for our own messages (already handled by mutation)
    if (normalizedData.author_id === currentUser?.id) {
      console.log('[Ably] Own message, skipping (mutation already invalidated):', normalizedData.message_id);
      return;
    }
    console.log('[Ably] Processing message from:', normalizedData.author_id, '(current user:', currentUser?.id, ')');

    // Determine message key
    const messageKey = normalizedData.channel_id || normalizedData.conversation_id || '';
    if (!messageKey) {
      console.warn('[Ably] Message missing channel_id and conversation_id:', normalizedData);
      return;
    }

    // Invalidate React Query cache to trigger refetch
    invalidateMessages(normalizedData.channel_id || null, normalizedData.conversation_id || null);
    console.log('[Ably] Invalidated cache for:', messageKey);
  }, [currentUser?.id, invalidateMessages]);

  /**
   * Subscribe to Ably channel via Go backend
   */
  const subscribeToChannel = useCallback(async (channelId: string) => {
    if (!isDesktop || !isWailsReady) {
      console.log('[Ably] Skipping subscribe - not desktop or not ready', { isDesktop, isWailsReady });
      return;
    }

    // Prevent duplicate subscriptions
    if (currentSubscriptionRef.current === channelId) {
      console.log('[Ably] Already subscribed to channel (frontend check):', channelId);
      return;
    }

    try {
      // Use dynamic access to Wails bindings
      const wailsApp = (window as any).go?.main?.App;
      if (!wailsApp) {
        console.warn('[Ably] Wails app not available');
        return;
      }

      // Check if Ably is ready before subscribing
      if (wailsApp.IsAblyReady && !wailsApp.IsAblyReady()) {
        console.warn('[Ably] Ably service not initialized yet, will retry when ready');
        return;
      }

      if (wailsApp.SubscribeToChannel) {
        console.log('[Ably] Subscribing to channel:', channelId);
        await wailsApp.SubscribeToChannel(channelId);
        currentSubscriptionRef.current = channelId;
        console.log('[Ably] Subscribed successfully to:', channelId);
      } else {
        console.warn('[Ably] SubscribeToChannel not available (backend may not be initialized)');
      }
    } catch (error) {
      console.error('[Ably] Failed to subscribe to channel:', error);
    }
  }, [isDesktop, isWailsReady]);

  /**
   * Unsubscribe from Ably channel via Go backend
   */
  const unsubscribeFromChannel = useCallback(async (channelId: string) => {
    if (!isDesktop || !isWailsReady) return;

    try {
      // Use dynamic access to Wails bindings
      const wailsApp = (window as any).go?.main?.App;
      if (!wailsApp) {
        return;
      }

      // Check if Ably is ready before unsubscribing
      if (wailsApp.IsAblyReady && !wailsApp.IsAblyReady()) {
        // If Ably isn't ready, just clear the ref - nothing to unsubscribe from
        if (currentSubscriptionRef.current === channelId) {
          currentSubscriptionRef.current = null;
        }
        return;
      }

      if (wailsApp.UnsubscribeFromChannel) {
        await wailsApp.UnsubscribeFromChannel(channelId);
        if (currentSubscriptionRef.current === channelId) {
          currentSubscriptionRef.current = null;
        }
      }
    } catch (error) {
      console.error('[Ably] Failed to unsubscribe from channel:', error);
    }
  }, [isDesktop, isWailsReady]);

  // Main effect: Manage subscriptions based on selected channel/conversation
  useEffect(() => {
    // Only run in desktop app when Wails is ready
    if (!isDesktop || !isWailsReady || networkStatus !== 'online') {
      return;
    }

    // Need a user to filter own messages
    if (!currentUser) {
      return;
    }

    // Check if we're already subscribed to this channel
    if (currentSubscriptionRef.current === activeChannelId && activeChannelId) {
      // Already subscribed to this channel, no need to do anything
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let isCleanedUp = false;

    const attemptSubscribe = async () => {
      if (isCleanedUp) return false;

      const wailsApp = (window as any).go?.main?.App;
      if (!wailsApp) {
        return false;
      }

      // Check if Ably is ready
      if (wailsApp.IsAblyReady && !wailsApp.IsAblyReady()) {
        return false;
      }

      // Check again if we're still on the same channel (might have changed during async)
      if (currentSubscriptionRef.current === activeChannelId && activeChannelId) {
        return true; // Already subscribed
      }

      // Ably is ready - proceed with subscription
      const previousChannelId = currentSubscriptionRef.current;
      if (previousChannelId && previousChannelId !== activeChannelId) {
        await unsubscribeFromChannel(previousChannelId);
      }

      if (activeChannelId && activeChannelId !== previousChannelId) {
        await subscribeToChannel(activeChannelId);
        return true;
      }

      return true;
    };

    // Try immediately
    attemptSubscribe().then((success) => {
      if (isCleanedUp) return;
      
      if (success) {
        // Successfully subscribed, no need to poll
        return;
      }

      // Ably not ready yet - poll every second until ready (max 10 attempts)
      console.log('[Ably] Ably not ready, polling for readiness...');
      let attempts = 0;
      pollInterval = setInterval(async () => {
        if (isCleanedUp || attempts >= 10) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }
        attempts++;
        const success = await attemptSubscribe();
        if (success && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }, 1000);
    });

    // Cleanup on unmount or when channel changes
    return () => {
      isCleanedUp = true;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      // Only unsubscribe if we're actually subscribed to this channel
      if (activeChannelId && currentSubscriptionRef.current === activeChannelId) {
        unsubscribeFromChannel(activeChannelId);
      }
    };
  }, [
    isDesktop,
    isWailsReady,
    activeChannelId,
    currentUser?.id, // Only depend on user ID, not the whole object
    networkStatus,
    // Removed subscribeToChannel and unsubscribeFromChannel from deps to prevent infinite loops
  ]);

  // Effect: Listen for Ably events from Go backend
  useEffect(() => {
    if (!isDesktop || !isWailsReady) {
      // Silently skip in web mode (Ably is desktop-only)
      return;
    }

    console.log('[Ably] Setting up event listener for ably:message');
    // Listen for 'ably:message' events from Go backend
    const unsubscribe = EventsOn('ably:message', handleAblyMessage);

    return () => {
      console.log('[Ably] Removing event listener for ably:message');
      unsubscribe();
    };
  }, [isDesktop, isWailsReady, handleAblyMessage]);

  // Effect: Periodic cleanup of deduplication IDs
  useEffect(() => {
    // Clean up dedupe IDs every 5 minutes
    dedupeCleanupTimerRef.current = setInterval(() => {
      cleanupDedupeIds();
    }, 5 * 60 * 1000);

    return () => {
      if (dedupeCleanupTimerRef.current) {
        clearInterval(dedupeCleanupTimerRef.current);
      }
    };
  }, [cleanupDedupeIds]);

  // Effect: Clean up invalidation timer on unmount
  useEffect(() => {
    return () => {
      if (invalidateTimerRef.current) {
        clearTimeout(invalidateTimerRef.current);
      }
    };
  }, []);
}

