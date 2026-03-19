import React from "react";
import { useAppStore } from "../../stores/appStore";
import { MessageList } from "../Message/MessageList";
import { ReplyPreview } from "../Message/ReplyPreview";
import { MessageQueue } from "../Message/MessageQueue";
import { useMessages, useSendMessage } from "../../hooks/queries";

export const MainContent: React.FC = () => {
  const {
    selectedChannelId,
    selectedConversationId,
    replyToMessageId,
    setReplyToMessageId,
    currentUser,
  } = useAppStore();

  const { data: messages = [] } = useMessages(
    selectedChannelId,
    selectedConversationId
  );
  const sendMessageMutation = useSendMessage();

  const handleSend = async (text: string) => {
    if (!text.trim() || (!selectedChannelId && !selectedConversationId) || !currentUser) {
      return;
    }
    try {
      await sendMessageMutation.mutateAsync({
        channelId: selectedChannelId || "",
        conversationId: selectedConversationId || "",
        content: text.trim(),
        replyToMessageId: replyToMessageId || undefined,
      });
      setReplyToMessageId(null);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (!selectedChannelId && !selectedConversationId) {
    return (
      <div
        data-testid="main-content"
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--c-bg)' }}
      >
        <p
          data-testid="empty-channel-message"
          className="text-xs font-mono"
          style={{ color: 'var(--c-text-muted)' }}
        >
          Select a channel to start messaging
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="main-content"
      className="flex-1 flex flex-col overflow-hidden min-w-0"
      style={{ background: 'var(--c-bg)' }}
    >
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <MessageList
          messages={messages}
          onReply={(id) => setReplyToMessageId(id)}
          onScrollToMessage={(id) => console.log("Scroll to:", id)}
          getAuthorUsername={(authorId) =>
            authorId === currentUser?.id ? (currentUser as any).username || "you" : "user"
          }
        />
      </div>

      {replyToMessageId && (
        <ReplyPreview
          messageId={replyToMessageId}
          allMessages={messages}
          onDismiss={() => setReplyToMessageId(null)}
          onScrollToMessage={(id) => console.log("Scroll to:", id)}
        />
      )}

      <MessageQueue />

      {/* Message input */}
      <form
        data-testid="message-form"
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--c-border)' }}
        onSubmit={(e) => {
          e.preventDefault();
          const ta = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement;
          handleSend(ta.value);
          ta.value = "";
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            data-testid="message-input"
            placeholder="Type a message…"
            aria-label="Message input"
            rows={1}
            className="pollis-textarea flex-1"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const ta = e.currentTarget;
              ta.style.height = "auto";
              ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.closest("form") as HTMLFormElement;
                form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            data-testid="message-send-button"
            className="btn-primary flex-shrink-0 self-end"
            style={{ paddingTop: 8, paddingBottom: 8 }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
