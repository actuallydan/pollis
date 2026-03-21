import { useEffect, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { useTauriReady } from './useTauriReady';
import { messageQueryKeys } from './queries/useMessages';

// Module-level ref so useSendMessage can publish data pings without owning the connection
export const livekitRoomRef: { current: Room | null } = { current: null };

export function useLiveKitRealtime() {
  const { isReady: isTauriReady } = useTauriReady();
  const queryClient = useQueryClient();
  const {
    selectedChannelId,
    selectedConversationId,
    currentUser,
    networkStatus,
  } = useAppStore();

  const roomRef = useRef<Room | null>(null);

  const activeRoomId = selectedChannelId ?? selectedConversationId;

  useEffect(() => {
    if (!isTauriReady) {
      return;
    }

    // Allow connection when online or when kill-switch is off.
    // 'offline' is not used as a gate here because navigator.onLine is
    // unreliable in Tauri's WKWebView — all network goes through Rust.
    if (!activeRoomId || !currentUser || networkStatus === 'kill-switch') {
      return;
    }

    let cancelled = false;

    const connect = async () => {
      const url = await invoke<string>('get_livekit_url');

      if (cancelled) {
        return;
      }

      if (!url || !url.trim()) {
        // LiveKit not configured — skip silently
        return;
      }

      const token = await invoke<string>('get_livekit_token', {
        roomName: activeRoomId,
        identity: currentUser.id,
        displayName: currentUser.username ?? currentUser.id,
      });

      if (cancelled) {
        return;
      }

      const room = new Room();

      room.on(RoomEvent.DataReceived, (payload, _participant) => {
        const text = new TextDecoder().decode(payload);

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }

        if (data.type !== 'new_message') {
          return;
        }

        // Skip own messages — optimistic update already applied
        if (data.senderId === currentUser.id) {
          return;
        }

        const channelId = (data.channelId as string | null) ?? null;
        const conversationId = (data.conversationId as string | null) ?? null;

        console.log('[LiveKit] ping received', { channelId, conversationId, selectedChannelId, selectedConversationId });

        if (channelId && channelId === selectedChannelId) {
          console.log('[LiveKit] invalidating channel messages', channelId);
          queryClient.invalidateQueries({
            queryKey: messageQueryKeys.channel(channelId),
          });
        } else if (conversationId && conversationId === selectedConversationId) {
          console.log('[LiveKit] invalidating conversation messages', conversationId);
          queryClient.invalidateQueries({
            queryKey: messageQueryKeys.conversation(conversationId),
          });
        } else {
          console.log('[LiveKit] ping did not match active channel/conversation — no refetch');
        }
      });

      console.log('[LiveKit] connecting to room', activeRoomId);
      await room.connect(url, token);

      if (cancelled) {
        room.disconnect();
        return;
      }

      console.log('[LiveKit] connected to room', activeRoomId);
      roomRef.current = room;
      livekitRoomRef.current = room;
    };

    connect().catch((err) => {
      console.error('[LiveKit] Failed to connect:', err);
    });

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
        livekitRoomRef.current = null;
      }
    };
  }, [
    isTauriReady,
    activeRoomId,
    currentUser?.id,
    currentUser?.username,
    networkStatus,
    selectedChannelId,
    selectedConversationId,
    queryClient,
  ]);
}
