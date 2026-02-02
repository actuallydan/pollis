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
 * Hook to fetch messages for a channel
 */
export function useChannelMessages(channelId: string | null) {
  return useQuery({
    queryKey: messageQueryKeys.channel(channelId),
    queryFn: async (): Promise<Message[]> => {
      if (!channelId) {
        throw new Error("No channel ID provided");
      }

      // Dynamically import Wails function
      const { GetMessages } = await import("../../../wailsjs/go/main/App");
      const messages = await GetMessages(channelId, "", 50, 0);
      return messages as any as Message[];
    },
    enabled: !!channelId,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 10, // Poll every 10 seconds for new messages
  });
}

/**
 * Hook to fetch messages for a conversation (DM)
 */
export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messageQueryKeys.conversation(conversationId),
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) {
        throw new Error("No conversation ID provided");
      }

      // Dynamically import Wails function
      const { GetMessages } = await import("../../../wailsjs/go/main/App");
      const messages = await GetMessages("", conversationId, 50, 0);
      return messages as any as Message[];
    },
    enabled: !!conversationId,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 10, // Poll every 10 seconds for new messages
  });
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
    onSuccess: (newMessage, variables) => {
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
