import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../../stores/appStore";
import type { Message, DMConversation } from "../../types";

/**
 * Query keys for messages and conversations
 */
export const messageQueryKeys = {
  all: ["messages"] as const,
  channel: (channelId: string | null) =>
    ["messages", "channel", channelId] as const,
  conversation: (conversationId: string | null) =>
    ["messages", "conversation", conversationId] as const,
  dmConversations: (userId: string | null) =>
    ["dm-conversations", userId] as const,
};

/**
 * Transform raw backend message to frontend Message type
 */
function transformMessage(m: any): Message {
  return {
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
  };
}

/**
 * Unified hook to fetch messages for either a channel or conversation
 * Only one of channelId or conversationId should be provided
 */
export function useMessages(
  channelId: string | null,
  conversationId: string | null
) {
  const isChannel = !!channelId;
  const queryKey = isChannel
    ? messageQueryKeys.channel(channelId)
    : messageQueryKeys.conversation(conversationId);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Message[]> => {
      const { GetMessages } = await import("../../../wailsjs/go/main/App");
      const messages = await GetMessages(
        channelId || "",
        conversationId || "",
        50,
        0
      );
      return (messages || []).map(transformMessage);
    },
    enabled: !!(channelId || conversationId),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 10,
  });
}

/**
 * Hook to fetch messages for a channel
 * @deprecated Use useMessages(channelId, null) instead
 */
export function useChannelMessages(channelId: string | null) {
  return useMessages(channelId, null);
}

/**
 * Hook to fetch messages for a conversation (DM)
 * @deprecated Use useMessages(null, conversationId) instead
 */
export function useConversationMessages(conversationId: string | null) {
  return useMessages(null, conversationId);
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);

  return useMutation({
    mutationFn: async ({
      channelId,
      conversationId,
      content,
      replyToMessageId,
    }: {
      channelId: string;
      conversationId: string;
      content: string;
      replyToMessageId?: string;
    }) => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      // Dynamically import Wails function
      const { SendMessage } = await import("../../../wailsjs/go/main/App");
      return await SendMessage(
        channelId,
        conversationId,
        currentUser.id,
        content,
        replyToMessageId || ""
      );
    },
    onSuccess: (_newMessage, variables) => {
      // Determine which query to invalidate based on channelId or conversationId
      if (variables.channelId) {
        queryClient.invalidateQueries({
          queryKey: messageQueryKeys.channel(variables.channelId),
        });
      } else if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: messageQueryKeys.conversation(variables.conversationId),
        });
      }
    },
  });
}

/**
 * Hook to fetch DM conversations for current user
 */
export function useDMConversations() {
  const currentUser = useAppStore((state) => state.currentUser);

  return useQuery({
    queryKey: messageQueryKeys.dmConversations(currentUser?.id ?? null),
    queryFn: async (): Promise<DMConversation[]> => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      // Dynamically import Wails function
      const { ListDMConversations } = await import(
        "../../../wailsjs/go/main/App"
      );
      return await ListDMConversations(currentUser.id);
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to create or get a DM conversation
 */
export function useCreateOrGetDMConversation() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);

  return useMutation({
    mutationFn: async (identifier: string) => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      // Dynamically import Wails function
      const { CreateOrGetDMConversation } = await import(
        "../../../wailsjs/go/main/App"
      );
      return await CreateOrGetDMConversation(currentUser.id, identifier.trim());
    },
    onSuccess: () => {
      // Invalidate DM conversations query to refetch
      queryClient.invalidateQueries({
        queryKey: messageQueryKeys.dmConversations(currentUser?.id ?? null),
      });
    },
  });
}
