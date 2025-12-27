import React, { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { ChannelHeader } from "./ChannelHeader";
import { MessageList } from "../Message/MessageList";
import { ReplyPreview } from "../Message/ReplyPreview";
import { MessageQueue } from "../Message/MessageQueue";
import { ChatInput, type Attachment } from "monopollis";
import { GetMessages, SendMessage } from "../../../wailsjs/go/main/App";
import type { MessageAttachment } from "../../types";

export const MainContent: React.FC = () => {
  const {
    selectedChannelId,
    selectedConversationId,
    messages,
    replyToMessageId,
    setReplyToMessageId,
    setMessages,
    addMessage,
    currentUser,
  } = useAppStore();

  const messageKey = selectedChannelId || selectedConversationId || "";
  const currentMessages = messages[messageKey] || [];

  // Load messages when channel/conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!messageKey) return;

      try {
        const loadedMessages = await GetMessages(
          selectedChannelId || "",
          selectedConversationId || "",
          50,
          0
        );

        // Convert to our Message type
        const messagesData = (loadedMessages || []).map((m: any) => ({
          id: m.id,
          channel_id: m.channel_id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          ciphertext: new Uint8Array(),
          nonce: new Uint8Array(),
          content_decrypted: m.content,
          reply_to_message_id: m.reply_to_message_id,
          thread_id: m.thread_id,
          is_pinned: m.is_pinned,
          created_at: m.created_at,
          delivered: m.delivered || false,
          attachments: m.attachments || [],
        }));

        setMessages(messageKey, messagesData);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    loadMessages();
  }, [selectedChannelId, selectedConversationId, messageKey, setMessages]);

  const handleSend = async (messageText: string, attachments: Attachment[]) => {
    if (!messageText.trim() && attachments.length === 0) return;
    if (!selectedChannelId && !selectedConversationId) return;
    if (!currentUser) return;

    try {
      // Send message via backend
      // The CHECK constraint requires exactly one of channel_id or conversation_id to be set
      // Pass the one that's set, and empty string for the other (backend should convert empty string to NULL)
      const channelId = selectedChannelId || "";
      const conversationId = selectedConversationId || "";

      // Ensure we have exactly one
      if (!channelId && !conversationId) {
        console.error("Either channelId or conversationId must be set");
        return;
      }
      if (channelId && conversationId) {
        console.error("Cannot set both channelId and conversationId");
        return;
      }

      // Convert attachments to MessageAttachment format
      const messageAttachments: MessageAttachment[] = attachments.map(
        (att) => ({
          id: att.id,
          object_key: att.objectKey!,
          filename: att.file.name,
          content_type: att.file.type || "application/octet-stream",
          file_size: att.file.size,
          uploaded_at: Date.now(),
        })
      );

      const sentMessage = await SendMessage(
        channelId,
        conversationId,
        currentUser.id,
        messageText.trim(),
        replyToMessageId || ""
      );

      // Convert to our Message type and add optimistically
      // Note: Backend returns 'content' field, we map it to 'content_decrypted' for frontend
      const messageData: any = {
        id: sentMessage.id,
        channel_id: sentMessage.channel_id,
        conversation_id: sentMessage.conversation_id,
        sender_id: sentMessage.sender_id,
        ciphertext: new Uint8Array(),
        nonce: new Uint8Array(),
        content_decrypted: (sentMessage as any).content, // Backend returns 'content', we use 'content_decrypted'
        reply_to_message_id: sentMessage.reply_to_message_id,
        thread_id: sentMessage.thread_id,
        is_pinned: sentMessage.is_pinned,
        created_at: sentMessage.created_at,
        delivered: sentMessage.delivered || false,
        attachments: messageAttachments,
        status: "sent",
      };

      addMessage(messageKey, messageData);

      // Clear reply after sending
      setReplyToMessageId(null);
    } catch (error) {
      console.error("Failed to send message:", error);
      // TODO: Show error to user
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
          messages={currentMessages}
          onReply={handleReply}
          onScrollToMessage={handleScrollToMessage}
          getAuthorUsername={getAuthorUsername}
        />
      </div>

      {replyToMessageId && (
        <ReplyPreview
          messageId={replyToMessageId}
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
