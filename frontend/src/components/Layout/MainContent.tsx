import React from "react";
import { useAppStore } from "../../stores/appStore";
import { ChannelHeader } from "./ChannelHeader";
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

  const handleSend = async (messageText: string) => {
    if (!messageText.trim()) {
      return;
    }
    if (!selectedChannelId && !selectedConversationId) {
      return;
    }
    if (!currentUser) {
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        channelId: selectedChannelId || "",
        conversationId: selectedConversationId || "",
        content: messageText.trim(),
        replyToMessageId: replyToMessageId || undefined,
      });

      setReplyToMessageId(null);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleReply = (messageId: string) => {
    setReplyToMessageId(messageId);
    setTimeout(() => {
      const textarea = document.querySelector(
        'textarea[aria-label="Message input"]'
      ) as HTMLTextAreaElement | null;
      textarea?.focus();
    }, 0);
  };

  const handleDismissReply = () => {
    setReplyToMessageId(null);
  };

  const handleScrollToMessage = (messageId: string) => {
    console.log("Scroll to message:", messageId);
  };

  const getAuthorUsername = (authorId: string): string => {
    return authorId === currentUser?.id ? "You" : "User";
  };

  if (!selectedChannelId && !selectedConversationId) {
    return (
      <div data-testid="main-content">
        <p data-testid="empty-channel-message">
          Select a channel or conversation to start messaging
        </p>
      </div>
    );
  }

  return (
    <div data-testid="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      <ChannelHeader />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <MessageList
          messages={messages}
          onReply={handleReply}
          onScrollToMessage={handleScrollToMessage}
          getAuthorUsername={getAuthorUsername}
        />
      </div>

      {replyToMessageId && (
        <ReplyPreview
          messageId={replyToMessageId}
          allMessages={messages}
          onDismiss={handleDismissReply}
          onScrollToMessage={handleScrollToMessage}
        />
      )}

      <MessageQueue />

      <form
        data-testid="message-form"
        onSubmit={(e) => {
          e.preventDefault();
          const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement;
          const val = textarea.value;
          if (val.trim()) {
            handleSend(val);
            textarea.value = "";
          }
        }}
      >
        <textarea
          data-testid="message-input"
          placeholder="Type a message..."
          aria-label="Message input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const form = e.currentTarget.closest("form") as HTMLFormElement;
              form?.requestSubmit();
            }
          }}
        />
        <button type="submit" data-testid="message-send-button">Send</button>
      </form>
    </div>
  );
};
