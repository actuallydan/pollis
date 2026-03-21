import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, Participant, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';
import { useTauriReady } from './useTauriReady';

export interface VoiceParticipant {
  identity: string;
  name: string;
  isMuted: boolean;
  isLocal: boolean;
}

interface UseVoiceChannelResult {
  participants: VoiceParticipant[];
  activeSpeakerIds: string[];
  isMuted: boolean;
  toggleMute: () => Promise<void>;
  leave: () => void;
}

// Separate Room instance solely for audio — never used for data pings.
// See spec section 5: two Room instances are intentional.
export function useVoiceChannel(channelId: string | null): UseVoiceChannelResult {
  const { isReady: isTauriReady } = useTauriReady();
  const { currentUser, networkStatus, setActiveVoiceChannelId } = useAppStore();

  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  // Build the participant list from current room state
  const syncParticipants = useCallback((room: Room) => {
    const local = room.localParticipant;
    const locals: VoiceParticipant[] = [
      {
        identity: local.identity,
        name: local.name || local.identity,
        isMuted: !local.isMicrophoneEnabled,
        isLocal: true,
      },
    ];

    const remotes: VoiceParticipant[] = Array.from(room.remoteParticipants.values()).map(
      (p: RemoteParticipant) => {
        const micPub = p.getTrackPublication('microphone' as any);
        return {
          identity: p.identity,
          name: p.name || p.identity,
          isMuted: micPub ? micPub.isMuted : true,
          isLocal: false,
        };
      }
    );

    setParticipants([...locals, ...remotes]);
    // Keep local mute indicator in sync
    setIsMuted(!local.isMicrophoneEnabled);
  }, []);

  useEffect(() => {
    if (!channelId || !isTauriReady || !currentUser || networkStatus === 'kill-switch') {
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
        roomName: channelId,
        identity: `voice-${currentUser.id}`,
        displayName: currentUser.username ?? currentUser.id,
      });

      if (cancelled) {
        return;
      }

      const room = new Room();

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setActiveSpeakerIds(speakers.map((s) => s.identity));
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        syncParticipants(room);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        syncParticipants(room);
      });

      room.on(RoomEvent.TrackMuted, () => {
        syncParticipants(room);
      });

      room.on(RoomEvent.TrackUnmuted, () => {
        syncParticipants(room);
      });

      room.on(RoomEvent.LocalTrackPublished, () => {
        syncParticipants(room);
      });

      room.on(RoomEvent.Disconnected, () => {
        setParticipants([]);
        setActiveSpeakerIds([]);
      });

      console.log('[VoiceChannel] connecting to room', channelId);
      await room.connect(url, token);

      if (cancelled) {
        room.disconnect();
        return;
      }

      // Publish local microphone on join
      await room.localParticipant.setMicrophoneEnabled(true);

      console.log('[VoiceChannel] connected and mic enabled for room', channelId);
      roomRef.current = room;
      syncParticipants(room);
    };

    connect().catch((err) => {
      console.error('[VoiceChannel] Failed to connect:', err);
    });

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setParticipants([]);
      setActiveSpeakerIds([]);
    };
  }, [
    channelId,
    isTauriReady,
    currentUser?.id,
    currentUser?.username,
    networkStatus,
    syncParticipants,
  ]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      return;
    }
    const newEnabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(newEnabled);
    setIsMuted(!newEnabled);
    syncParticipants(room);
  }, [syncParticipants]);

  const leave = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setParticipants([]);
    setActiveSpeakerIds([]);
    setActiveVoiceChannelId(null);
  }, [setActiveVoiceChannelId]);

  return { participants, activeSpeakerIds, isMuted, toggleMute, leave };
}
