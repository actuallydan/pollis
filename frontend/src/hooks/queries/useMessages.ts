import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import type { Message } from "../../types";

export const messageQueryKeys = {
  all: ["messages"] as const,
  channel: (channelId: string | null) => ["messages", "channel", channelId] as const,
  conversation: (conversationId: string | null) => ["messages", "conversation", conversationId] as const,
  dmConversations: (userId: string | null) => ["dm-conversations", userId] as const,
};

type RawMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content?: string;
  reply_to_id?: string;
  sent_at: string;
};

function transformMessage(m: RawMessage): Message {
  return {
    id: m.id,
    channel_id: undefined,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    ciphertext: new Uint8Array(),
    nonce: new Uint8Array(),
    content_decrypted: m.content || '',
    reply_to_message_id: m.reply_to_id,
    is_pinned: false,
    created_at: new Date(m.sent_at).getTime(),
    delivered: true,
    status: 'sent' as const,
    attachments: [],
  };
}

export function useMessages(channelId: string | null, conversationId: string | null) {
  const isChannel = !!channelId;
  const queryKey = isChannel
    ? messageQueryKeys.channel(channelId)
    : messageQueryKeys.conversation(conversationId);

  // In the Tauri backend, channels are addressed by their ID as the conversation_id
  const targetId = channelId || conversationId || '';

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Message[]> => {
      const messages = await invoke<RawMessage[]>('list_messages', {
        conversationId: targetId,
        limit: 50,
      });
      return (messages || []).map(transformMessage);
    },
    enabled: !!(channelId || conversationId),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 10,
  });
}

/**
 * @deprecated Use useMessages(channelId, null) instead
 */
export function useChannelMessages(channelId: string | null) {
  return useMessages(channelId, null);
}

/**
 * @deprecated Use useMessages(null, conversationId) instead
 */
export function useConversationMessages(conversationId: string | null) {
  return useMessages(null, conversationId);
}

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

      const targetId = channelId || conversationId;
      return await invoke<RawMessage>('send_message', {
        conversationId: targetId,
        senderId: currentUser.id,
        content,
        replyToId: replyToMessageId ?? null,
      });
    },
    onSuccess: (_newMessage, variables) => {
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

export function useDMConversations() {
  const currentUser = useAppStore((state) => state.currentUser);

  return useQuery({
    queryKey: messageQueryKeys.dmConversations(currentUser?.id ?? null),
    queryFn: async () => {
      // DM conversations not yet implemented in Tauri backend
      return [];
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60,
  });
}

export function useCreateOrGetDMConversation() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);

  return useMutation({
    mutationFn: async (_identifier: string): Promise<{ id: string }> => {
      // DM conversations not yet implemented in Tauri backend
      throw new Error('DM conversations not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messageQueryKeys.dmConversations(currentUser?.id ?? null),
      });
    },
  });
}
