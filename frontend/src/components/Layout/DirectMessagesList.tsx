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
}) => (
  <div data-testid="dm-list" className="py-1 divider">
    {!isCollapsed && (
      <div className="section-label px-3 pt-2 pb-1">Direct Messages</div>
    )}

    {conversations.length === 0 ? (
      !isCollapsed && (
        <p className="px-3 py-1 text-xs" style={{ color: 'var(--c-text-muted)' }}>
          No DMs yet.
        </p>
      )
    ) : (
      conversations.map((conv) => {
        const isActive = selectedConversationId === conv.id;
        return (
          <button
            key={conv.id}
            data-testid={`dm-item-${conv.id}`}
            onClick={() => {
              onSelectConversation(conv.id);
              updateURL(`/c/${conv.id}`);
            }}
            title={isCollapsed ? conv.user2_identifier : undefined}
            aria-label={`Direct message with ${conv.user2_identifier}`}
            className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
          >
            <MessageCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
            {!isCollapsed && (
              <span className="truncate text-xs">{conv.user2_identifier}</span>
            )}
          </button>
        );
      })
    )}

    {onStartDM && (
      <button
        data-testid="start-dm-button"
        onClick={onStartDM}
        aria-label="Start direct message"
        className="sidebar-item"
        style={{ color: 'var(--c-text-muted)' }}
      >
        <Plus size={17} aria-hidden="true" />
        {!isCollapsed && <span className="text-xs">New message</span>}
      </button>
    )}
  </div>
);
