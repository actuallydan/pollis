import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../services/api";
import { useAppStore } from "../../stores/appStore";

/**
 * User profile data from service DB (network-first)
 */
export interface ServiceUserData {
  username: string;
  email: string;
  phone: string;
  avatar_url?: string;
}

/**
 * Query keys for user data
 */
export const userQueryKeys = {
  profile: (userId: string | null) => ["user", "profile", userId] as const,
};

/**
 * Hook to fetch user profile data from service DB
 * This is network-first and will automatically refetch on window focus
 */
export function useUserProfile() {
  const currentUser = useAppStore((state) => state.currentUser);

  return useQuery({
    queryKey: userQueryKeys.profile(currentUser?.id ?? null),
    queryFn: async (): Promise<ServiceUserData> => {
      if (!currentUser) {
        throw new Error("No current user");
      }
      return await api.getServiceUserData();
    },
    enabled: !!currentUser, // Only run query if user is logged in
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
    gcTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to window
    refetchOnReconnect: true, // Refetch when reconnecting to internet
  });
}

/**
 * Hook to update user profile (username, email, phone)
 * Automatically invalidates and refetches user profile data after update
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setUsername = useAppStore((state) => state.setUsername);

  return useMutation({
    mutationFn: async ({
      username,
      email,
      phone,
    }: {
      username: string;
      email: string | null;
      phone: string | null;
    }) => {
      await api.updateServiceUserData(username, email, phone);
      return { username, email, phone };
    },
    onSuccess: (data) => {
      // Update Zustand store for immediate UI update
      setUsername(data.username);

      // Invalidate and refetch user profile data
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.profile(currentUser?.id ?? null),
      });
    },
  });
}

/**
 * Hook to get user avatar download URL (presigned URL from R2)
 * Depends on useUserProfile to get the avatar object key
 */
export function useUserAvatar() {
  const { data: userProfile } = useUserProfile();
  const currentUser = useAppStore((state) => state.currentUser);

  return useQuery({
    queryKey: ["user", "avatar", currentUser?.id, userProfile?.avatar_url],
    queryFn: async (): Promise<string | null> => {
      if (!userProfile?.avatar_url) {
        return null;
      }
      // Get presigned download URL from R2
      const { getFileDownloadUrl } = await import("../../services/r2-upload");
      return await getFileDownloadUrl(userProfile.avatar_url);
    },
    enabled: !!currentUser && !!userProfile?.avatar_url,
    staleTime: 1000 * 60 * 30, // Presigned URLs are valid for 1 hour, consider fresh for 30 min
    gcTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 1,
  });
}

/**
 * Hook to update user avatar
 * Automatically invalidates and refetches user profile data and avatar URL after update
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const setUserAvatarUrl = useAppStore((state) => state.setUserAvatarUrl);

  return useMutation({
    mutationFn: async (avatarUrl: string) => {
      await api.updateServiceUserAvatar(avatarUrl);
      return avatarUrl;
    },
    onSuccess: (avatarUrl) => {
      // Update Zustand store for immediate UI update
      setUserAvatarUrl(avatarUrl);

      // Invalidate and refetch user profile data (which includes avatar_url)
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.profile(currentUser?.id ?? null),
      });

      // Invalidate avatar download URL queries to refetch presigned URL
      queryClient.invalidateQueries({
        queryKey: ["user", "avatar", currentUser?.id],
      });
    },
  });
}
