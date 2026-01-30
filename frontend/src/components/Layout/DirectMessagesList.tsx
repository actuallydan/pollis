import React from "react";
import { MessageCircle, Plus } from "lucide-react";
import { Header, Paragraph } from "monopollis";
import { updateURL } from "../../utils/urlRouting";

interface Conversation {
  id: string;
  user2_identifier: string;
}

interface DirectMessagesListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  isCollapsed: boolean;
  onSelectConversation: (conversationId: string) => void;
  onStartDM?: () => void;
}

export const DirectMessagesList: React.FC<DirectMessagesListProps> = ({
  conversations,
  selectedConversationId,
  isCollapsed,
  onSelectConversation,
  onStartDM,
}) => {
  return (
    <div className="border-t border-orange-300/20">
      {!isCollapsed && (
        <div className="p-2 border-b border-orange-300/10">
          <Header size="sm" className="px-2 text-orange-300/80">
            Direct Messages
          </Header>
        </div>
      )}
      <div
        className={`max-h-48 overflow-y-auto ${
          isCollapsed ? "p-2 space-y-1" : ""
        }`}
      >
        {conversations.length === 0 ? (
          !isCollapsed && (
            <div className="p-4 text-center">
              <Paragraph size="sm" className="text-orange-300/50">
                No direct messages yet.
              </Paragraph>
            </div>
          )
        ) : (
          <div className={isCollapsed ? "space-y-1" : "py-1"}>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  updateURL(`/c/${conv.id}`);
                }}
                className={`flex items-center gap-2 hover:bg-orange-300/10 transition-colors rounded-md ${
                  isCollapsed
                    ? "w-9 h-9 justify-center text-orange-300/80 mx-auto"
                    : "w-full px-4 py-2 text-left text-orange-300/80"
                } ${
                  selectedConversationId === conv.id
                    ? "bg-orange-300/20 text-orange-300"
                    : ""
                }`}
                title={isCollapsed ? conv.user2_identifier : undefined}
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-mono text-sm truncate">
                    {conv.user2_identifier}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {onStartDM && (
          <button
            onClick={onStartDM}
            className={`flex items-center gap-2 hover:bg-orange-300/10 transition-colors text-orange-300/70 text-sm rounded-md ${
              isCollapsed
                ? "w-9 h-9 justify-center mx-auto"
                : "w-full px-4 py-2 justify-start"
            }`}
            aria-label="Start direct message"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span className="font-mono">Start DM</span>}
          </button>
        )}
      </div>
    </div>
  );
};
