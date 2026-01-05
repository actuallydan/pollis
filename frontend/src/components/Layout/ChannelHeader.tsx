import React from "react";
import { Hash, Pin, Info, MessageCircle, Settings } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Header, Paragraph } from "monopollis";
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
    currentUser,
  } = useAppStore();

  // Get current channel or conversation
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
      <div className="h-16 border-b border-orange-300/20 bg-black flex items-center justify-center">
        <Paragraph size="sm" className="text-orange-300/50">
          Select a channel or conversation
        </Paragraph>
      </div>
    );
  }

  return (
    <div className="h-16 border-b border-orange-300/20 bg-black flex items-center justify-between px-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {currentChannel ? (
          <>
            <Hash className="w-5 h-5 text-orange-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Header size="base" className="truncate">
                {currentChannel.name}
              </Header>
              {currentChannel.description && (
                <Paragraph
                  size="sm"
                  className="text-orange-300/70 truncate mt-0.5"
                >
                  {currentChannel.description}
                </Paragraph>
              )}
            </div>
          </>
        ) : (
          <>
            <MessageCircle className="w-5 h-5 text-orange-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Header size="base" className="truncate">
                {currentConversation?.user2_identifier || "Direct Message"}
              </Header>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <NetworkStatusIndicator />
        {currentGroup && (
          <button
            onClick={() => {
              updateURL(`/g/${currentGroup.slug}/settings`);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            className="p-2 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
            aria-label="Group settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
