import React from "react";
import { Hash, MessageCircle, Settings } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { NetworkStatusIndicator } from "../NetworkStatusIndicator";
import { updateURL } from "../../utils/urlRouting";

export const ChannelHeader: React.FC = () => {
  const {
    selectedChannelId,
    selectedConversationId,
    channels,
    selectedGroupId,
    groups,
    dmConversations,
  } = useAppStore();

  const currentChannel = selectedChannelId
    ? Object.values(channels)
        .flat()
        .find((c) => c.id === selectedChannelId)
    : null;

  const currentConversation = selectedConversationId
    ? dmConversations.find((c) => c.id === selectedConversationId)
    : null;

  const currentGroup = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)
    : null;

  if (!currentChannel && !currentConversation) {
    return (
      <div data-testid="channel-header">
        <p>Select a channel or conversation</p>
      </div>
    );
  }

  return (
    <div data-testid="channel-header">
      <div>
        {currentChannel ? (
          <>
            <Hash aria-hidden="true" />
            <div>
              <h2 data-testid="channel-name">{currentChannel.name}</h2>
              {currentChannel.description && (
                <p data-testid="channel-description">{currentChannel.description}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <MessageCircle aria-hidden="true" />
            <div>
              <h2 data-testid="channel-name">
                {currentConversation?.user2_identifier || "Direct Message"}
              </h2>
            </div>
          </>
        )}
      </div>

      <div>
        <NetworkStatusIndicator />
        {currentGroup && (
          <button
            data-testid="group-settings-button"
            onClick={() => {
              updateURL(`/g/${currentGroup.slug}/settings`);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            aria-label="Group settings"
          >
            <Settings aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
