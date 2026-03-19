import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../../services/api";
import type { GroupWithChannels } from "../../services/api";
import { useAppStore } from "../../stores/appStore";
import type { Group, Channel } from "../../types";

export const groupQueryKeys = {
  all: ["groups"] as const,
  userGroups: (userId: string | null) => ["groups", "user", userId] as const,
  userGroupsWithChannels: (userId: string | null) => ["groups", "with-channels", userId] as const,
  group: (groupId: string) => ["groups", groupId] as const,
  channels: (groupId: string) => ["groups", groupId, "channels"] as const,
};

export function useUserGroupsWithChannels() {
  const currentUser = useAppStore((state) => state.currentUser);

  return useQuery({
    queryKey: groupQueryKeys.userGroupsWithChannels(currentUser?.id ?? null),
    queryFn: async (): Promise<GroupWithChannels[]> => {
      if (!currentUser) {
        throw new Error("No current user");
      }
      return await api.listUserGroupsWithChannels(currentUser.id);
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
}

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
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
}

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
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setGroups = useAppStore((state) => state.setGroups);

  return useMutation({
    mutationFn: async ({
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

      return await invoke<{ id: string; name: string; description?: string; owner_id: string; created_at: string }>(
        'create_group',
        { name, description: description || null, ownerId: currentUser.id },
      );
    },
    onSuccess: (rawGroup) => {
      const ts = new Date(rawGroup.created_at).getTime();
      const newGroup: Group = {
        id: rawGroup.id,
        slug: '',
        name: rawGroup.name,
        description: rawGroup.description || '',
        created_by: rawGroup.owner_id,
        created_at: ts,
        updated_at: ts,
      };

      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
      });

      queryClient.setQueryData<Group[]>(
        groupQueryKeys.userGroups(currentUser?.id ?? null),
        (oldGroups) => {
          const updated = [...(oldGroups || []), newGroup];
          setGroups(updated);
          return updated;
        },
      );
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);

  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!currentUser) {
        throw new Error("No current user");
      }

      await invoke('invite_to_group', { groupId, userId: currentUser.id });
      return { id: groupId, slug: groupId, name: groupId, description: '', created_by: currentUser.id, created_at: 0, updated_at: 0 } as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
      });
    },
  });
}

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
      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.userGroups(currentUser?.id ?? null),
      });

      queryClient.setQueryData<Group[]>(
        groupQueryKeys.userGroups(currentUser?.id ?? null),
        (oldGroups) => {
          if (!oldGroups) {
            return oldGroups;
          }
          const updated = oldGroups.map((g) =>
            g.id === groupId ? { ...g, icon_url: iconUrl } : g,
          );
          setGroups(updated);
          return updated;
        },
      );
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setChannels = useAppStore((state) => state.setChannels);

  return useMutation({
    mutationFn: async ({
      groupId,
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

      return await invoke<{ id: string; group_id: string; name: string; description?: string }>(
        'create_channel',
        { groupId, name, description: description || null },
      );
    },
    onSuccess: (rawChannel, variables) => {
      const newChannel: Channel = {
        id: rawChannel.id,
        group_id: rawChannel.group_id,
        slug: '',
        name: rawChannel.name,
        description: rawChannel.description || '',
        channel_type: 'text',
        created_by: currentUser?.id || '',
        created_at: 0,
        updated_at: 0,
      };

      queryClient.invalidateQueries({
        queryKey: groupQueryKeys.channels(variables.groupId),
      });

      queryClient.setQueryData<Channel[]>(
        groupQueryKeys.channels(variables.groupId),
        (oldChannels) => {
          const updated = [...(oldChannels || []), newChannel];
          setChannels(variables.groupId, updated);
          return updated;
        },
      );
    },
  });
}
