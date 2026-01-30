import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarActions } from "./SidebarActions";
import { GroupsList } from "./GroupsList";
import { DirectMessagesList } from "./DirectMessagesList";
import { SidebarUserProfile } from "./SidebarUserProfile";

interface SidebarProps {
  onCreateGroup?: () => void;
  onCreateChannel?: () => void;
  onSearchGroup?: () => void;
  onStartDM?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onCreateGroup,
  onCreateChannel,
  onSearchGroup,
  onStartDM,
  onLogout,
}) => {
  const {
    groups,
    channels,
    currentUser,
    username,
    userAvatarUrl,
    setUserAvatarUrl,
    selectedGroupId,
    selectedChannelId,
    selectedConversationId,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
    dmConversations,
  } = useAppStore();
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(256);

  const maxWidth = Math.max(150, window.innerWidth - 150);
  const minSnap = 100;
  const collapsedWidth = 50;
  const newWidth = Math.max(collapsedWidth, Math.min(maxWidth, sidebarWidth));
  const isCollapsed = newWidth <= collapsedWidth + 1;

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - startXRef.current;
      let next = startWidthRef.current + delta;
      if (next <= minSnap) next = collapsedWidth;
      next = Math.max(collapsedWidth, Math.min(maxWidth, next));
      setSidebarWidth(next);
    };
    const onUp = () => {
      isResizingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [maxWidth]);

  const handleHomeClick = () => {
    setSelectedGroupId(null);
    setSelectedChannelId(null);
    setSelectedConversationId(null);
    if (typeof window !== "undefined") {
      window.history.pushState({ path: "/" }, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleAvatarError = () => {
    setUserAvatarUrl(null);
  };

  return (
    <div
      className="h-full bg-black border-r border-orange-300/20 flex flex-col relative"
      style={{ width: `${newWidth}px` }}
    >
      <SidebarHeader isCollapsed={isCollapsed} onHomeClick={handleHomeClick} />

      <SidebarActions
        isCollapsed={isCollapsed}
        onCreateGroup={onCreateGroup}
        onSearchGroup={onSearchGroup}
      />

      <GroupsList
        groups={groups}
        channels={channels}
        selectedGroupId={selectedGroupId}
        selectedChannelId={selectedChannelId}
        isCollapsed={isCollapsed}
        onSelectGroup={handleSelectGroup}
        onSelectChannel={handleSelectChannel}
        onCreateChannel={onCreateChannel}
      />

      <DirectMessagesList
        conversations={dmConversations}
        selectedConversationId={selectedConversationId}
        isCollapsed={isCollapsed}
        onSelectConversation={handleSelectConversation}
        onStartDM={onStartDM}
      />

      <SidebarUserProfile
        currentUser={currentUser}
        username={username}
        userAvatarUrl={userAvatarUrl}
        isCollapsed={isCollapsed}
        onAvatarError={handleAvatarError}
        onLogout={onLogout}
      />

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-orange-300/10 hover:bg-orange-300/30"
        aria-label="Resize sidebar"
      />
    </div>
  );
};
