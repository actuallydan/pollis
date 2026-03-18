import React from "react";
import { MessageCircle, Plus } from "lucide-react";
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
    <div data-testid="dm-list">
      {!isCollapsed && (
        <div>
          <h3>Direct Messages</h3>
        </div>
      )}
      <div>
        {conversations.length === 0 ? (
          !isCollapsed && (
            <div>
              <p>No direct messages yet.</p>
            </div>
          )
        ) : (
          <div>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                data-testid={`dm-item-${conv.id}`}
                onClick={() => {
                  onSelectConversation(conv.id);
                  updateURL(`/c/${conv.id}`);
                }}
                title={isCollapsed ? conv.user2_identifier : undefined}
                aria-label={`Direct message with ${conv.user2_identifier}`}
              >
                <MessageCircle aria-hidden="true" />
                {!isCollapsed && <span>{conv.user2_identifier}</span>}
              </button>
            ))}
          </div>
        )}
        {onStartDM && (
          <button
            data-testid="start-dm-button"
            onClick={onStartDM}
            aria-label="Start direct message"
          >
            <Plus aria-hidden="true" />
            {!isCollapsed && <span>Start DM</span>}
          </button>
        )}
      </div>
    </div>
  );
};
