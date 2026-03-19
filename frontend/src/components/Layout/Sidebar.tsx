import React, { useEffect, useRef } from "react";
import { useAppStore } from "../../stores/appStore";
import { useUserProfile, useUserAvatar } from "../../hooks/queries";
import { GroupsList } from "./GroupsList";
import { SidebarUserProfile } from "./SidebarUserProfile";

const COLLAPSED_WIDTH = 44;

interface SidebarProps {
  width: number;
  onWidthChange: (w: number) => void;
  onCreateChannel?: () => void;
  onStartDM?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  width,
  onWidthChange,
  onCreateChannel,
  onLogout,
}) => {
  const {
    groups,
    channels,
    currentUser,
    username: storeUsername,
    userAvatarUrl,
    setUserAvatarUrl,
    setUsername: setStoreUsername,
    selectedGroupId,
    selectedChannelId,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
  } = useAppStore();

  const { data: userProfile } = useUserProfile();
  const { data: avatarDownloadUrl } = useUserAvatar();
  const username = userProfile?.username || storeUsername;

  useEffect(() => {
    if (userProfile?.username && userProfile.username !== storeUsername) {
      setStoreUsername(userProfile.username);
    }
  }, [userProfile?.username, storeUsername, setStoreUsername]);

  useEffect(() => {
    if (avatarDownloadUrl && avatarDownloadUrl !== userAvatarUrl) {
      setUserAvatarUrl(avatarDownloadUrl);
    }
  }, [avatarDownloadUrl, userAvatarUrl, setUserAvatarUrl]);

  const isCollapsed = width <= COLLAPSED_WIDTH + 1;

  // Resize drag state
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    e.preventDefault();
  };

  useEffect(() => {
    const maxWidth = Math.max(150, window.innerWidth - 150);
    const minSnap = 100;

    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) {
        return;
      }
      const delta = e.clientX - startXRef.current;
      let next = startWidthRef.current + delta;
      if (next <= minSnap) {
        next = COLLAPSED_WIDTH;
      }
      next = Math.max(COLLAPSED_WIDTH, Math.min(maxWidth, next));
      onWidthChange(next);
    };

    const onUp = () => { isResizingRef.current = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange]);

  const handleHomeClick = () => {
    setSelectedGroupId(null);
    setSelectedChannelId(null);
    setSelectedConversationId(null);
    window.history.pushState({ path: "/" }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div
      data-testid="sidebar"
      className="flex flex-col h-full relative flex-shrink-0"
      style={{
        width,
        background: "var(--c-surface)",
        borderRight: "1px solid var(--c-border)",
      }}
    >
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <GroupsList
          groups={groups}
          channels={channels}
          selectedGroupId={selectedGroupId}
          selectedChannelId={selectedChannelId}
          isCollapsed={isCollapsed}
          onSelectGroup={(id) => setSelectedGroupId(id)}
          onSelectChannel={(id) => setSelectedChannelId(id)}
          onCreateChannel={onCreateChannel}
        />
      </div>

      <SidebarUserProfile
        currentUser={currentUser}
        username={username}
        userAvatarUrl={userAvatarUrl}
        isCollapsed={isCollapsed}
        onAvatarError={() => setUserAvatarUrl(null)}
        onLogout={onLogout}
      />

      {/* Resize handle */}
      <div
        data-testid="sidebar-resize-handle"
        onMouseDown={handleMouseDown}
        aria-label="Resize sidebar"
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--c-border-active)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      />
    </div>
  );
};
