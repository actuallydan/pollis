import React from "react";
import { useAppStore } from "../../stores/appStore";
import { ChannelHeader } from "./ChannelHeader";
import { MessageList } from "../Message/MessageList";
import { ReplyPreview } from "../Message/ReplyPreview";
import { MessageQueue } from "../Message/MessageQueue";
import { ChatInput, type Attachment } from "monopollis";
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

  const handleSend = async (messageText: string, _attachments: Attachment[]) => {
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
    // Focus the input after selecting reply
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
    // The MessageList component handles scrolling internally
    console.log("Scroll to message:", messageId);
  };

  const getAuthorUsername = (authorId: string): string => {
    // TODO: Get username from service or cache
    // For now, return a placeholder
    return authorId === currentUser?.id ? "You" : "User";
  };

  if (!selectedChannelId && !selectedConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-orange-300/80 font-mono text-base">
            Select a channel or conversation to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden min-w-0">
      <ChannelHeader />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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

      <ChatInput
        onSend={handleSend}
        placeholder="Type a message..."
        disabled={false}
      />
    </div>
  );
};
