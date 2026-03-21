import React from "react";
import { useVoiceChannel } from "../../hooks/useVoiceChannel";
import { useAppStore } from "../../stores/appStore";

interface VoiceChannelViewProps {
  channelId: string | null;
  channelName: string;
}

export const VoiceChannelView: React.FC<VoiceChannelViewProps> = ({ channelId, channelName }) => {
  const { participants, activeSpeakerIds } = useVoiceChannel(channelId);
  const { activeVoiceChannelId } = useAppStore();

  return (
    <div
      data-testid="voice-channel-view"
      className="flex flex-col h-full font-mono text-xs"
      style={{ background: "var(--c-bg)", color: "var(--c-text)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--c-border)", color: "var(--c-text-muted)" }}
      >
        <span data-testid="voice-channel-name">[v] {channelName}</span>
      </div>

      {/* Divider */}
      <div
        className="mx-4 mt-3 mb-1 flex-shrink-0 text-xs"
        style={{ color: "var(--c-text-dim)", borderBottom: "1px solid var(--c-border)" }}
      />

      {/* Participant list */}
      <div
        data-testid="voice-participant-list"
        className="flex-1 overflow-auto px-4 py-2 flex flex-col gap-1"
      >
        {participants.length === 0 && (
          <span style={{ color: "var(--c-text-dim)" }}>Connecting…</span>
        )}
        {participants.map((p) => {
          const isSpeaking = activeSpeakerIds.includes(p.identity);
          return (
            <div
              key={p.identity}
              data-testid={`voice-participant-${p.identity}`}
              className="flex items-center gap-3"
              style={{ color: p.isLocal ? "var(--c-accent)" : "var(--c-text)" }}
            >
              {/* Username */}
              <span className="flex-1 truncate">
                {p.name}
                {p.isLocal && (
                  <span style={{ color: "var(--c-text-dim)" }}> (you)</span>
                )}
              </span>

              {/* Speaking indicator */}
              {isSpeaking && !p.isMuted && (
                <span
                  data-testid={`voice-speaking-${p.identity}`}
                  style={{ color: "var(--c-accent)" }}
                  title="Speaking"
                >
                  ●
                </span>
              )}

              {/* Muted indicator */}
              {p.isMuted && (
                <span
                  data-testid={`voice-muted-${p.identity}`}
                  style={{ color: "var(--c-text-dim)" }}
                  title="Muted"
                >
                  [m]
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom divider */}
      <div
        className="mx-4 mb-2 flex-shrink-0"
        style={{ borderTop: "1px solid var(--c-border)" }}
      />

      {/* Status note */}
      {activeVoiceChannelId && (
        <div
          className="px-4 pb-3 flex-shrink-0 text-xs"
          style={{ color: "var(--c-text-dim)" }}
        >
          Use the bar below to mute or leave.
        </div>
      )}
    </div>
  );
};
