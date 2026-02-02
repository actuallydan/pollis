import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../services/api";
import { useAppStore } from "../../stores/appStore";
import type { Group, Channel } from "../../types";

/**
 * Query keys for groups and channels
 */
export const groupQueryKeys = {
  all: ["groups"] as const,
  userGroups: (userId: string | null) => ["groups", "user", userId] as const,
  group: (groupId: string) => ["groups", groupId] as const,
  channels: (groupId: string) => ["groups", groupId, "channels"] as const,
};

/**
 * Hook to fetch user's groups
 */
export function useUserGroups() {
  const currentUser = useAppStore((state) => state.currentUser);

  return useQuery({
    queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
    queryFn: async (): Promise<Group[]> => {
      if (!currentUser) {
        throw new Error("No current user");
      }
      return await api.listUserGroups(currentUser.id);
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch channels for a specific group
 */
export function useGroupChannels(groupId: string | null) {
  return useQuery({
    queryKey: groupQueryKeys.channels(groupId ?? ""),
    queryFn: async (): Promise<Channel[]> => {
      if (!groupId) {
        throw new Error("No group ID provided");
      }
      return await api.listChannels(groupId);
    },
    enabled: !!groupId,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to create a new group
 */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setGroups = useAppStore((state) => state.setGroups);

  return useMutation({
    mutationFn: async ({
      slug,
      name,
      description,
    }: {
      slug: string;
      name: string;
      description: string;
    }) => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      // Dynamically import Wails function
      const { CreateGroup } = await import("../../../wailsjs/go/main/App");
      return await CreateGroup(slug, name, description, currentUser.id);
    },
    onSuccess: (newGroup) => {
      // Invalidate user groups query to refetch
      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
      });

      // Optimistically update the store
      queryClient.setQueryData<Group[]>(
        groupQueryKeys.userGroups(currentUser?.id ?? null),
        (oldGroups) => {
          const updated = [...(oldGroups || []), newGroup];
          setGroups(updated); // Update Zustand store for immediate UI update
          return updated;
        }
      );
    },
  });
}

/**
 * Hook to join a group by slug
 */
export function useJoinGroup() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);

  return useMutation({
    mutationFn: async (slug: string) => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      // Dynamically import Wails functions
      const { GetGroupBySlug, AddGroupMember } = await import(
        "../../../wailsjs/go/main/App"
      );

      const group = await GetGroupBySlug(slug.trim());
      await AddGroupMember(group.id, currentUser.id);
      return group;
    },
    onSuccess: () => {
      // Invalidate user groups query to refetch
      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
      });
    },
  });
}

/**
 * Hook to update group icon
 * Automatically invalidates and refetches group data after update
 */
export function useUpdateGroupIcon() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setGroups = useAppStore((state) => state.setGroups);

  return useMutation({
    mutationFn: async ({ groupId, iconUrl }: { groupId: string; iconUrl: string }) => {
      await api.updateGroupIcon(groupId, iconUrl);
      return { groupId, iconUrl };
    },
    onSuccess: ({ groupId, iconUrl }) => {
      // Invalidate user groups query to refetch with updated icon
      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
      });

      // Optimistically update the store
      queryClient.setQueryData<Group[]>(
        groupQueryKeys.userGroups(currentUser?.id ?? null),
        (oldGroups) => {
          if (!oldGroups) return oldGroups;
          const updated = oldGroups.map((g) =>
            g.id === groupId ? { ...g, icon_url: iconUrl } : g
          );
          setGroups(updated);
          return updated;
        }
      );
    },
  });
}

/**
 * Hook to create a channel in a group
 */
export function useCreateChannel() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setChannels = useAppStore((state) => state.setChannels);

  return useMutation({
    mutationFn: async ({
      groupId,
      slug,
      name,
      description,
    }: {
      groupId: string;
      slug: string;
      name: string;
      description: string;
    }) => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      // Dynamically import Wails function
      const { CreateChannel } = await import("../../../wailsjs/go/main/App");
      return await CreateChannel(
        groupId,
        slug,
        name,
        description,
        currentUser.id
      );
    },
    onSuccess: (newChannel, variables) => {
      // Invalidate channels query for this group
      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.channels(variables.groupId),
      });

      // Optimistically update the store
      queryClient.setQueryData<Channel[]>(
        groupQueryKeys.channels(variables.groupId),
        (oldChannels) => {
          const updated = [...(oldChannels || []), newChannel];
          setChannels(variables.groupId, updated); // Update Zustand store
          return updated;
        }
      );
    },
  });
}
