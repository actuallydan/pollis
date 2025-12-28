import React, { useEffect, useRef, useState } from "react";
import {
  Hash,
  MessageCircle,
  Plus,
  Search,
  LogOut,
  LucideIcon,
  User,
  Settings,
  Image as ImageIcon,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Button, Header, Paragraph } from "monopollis";
import { updateURL, deriveSlug } from "../../utils/urlRouting";
import logo from "../../assets/images/LogoBigMono.svg";

interface SidebarProps {
  onCreateGroup?: () => void;
  onCreateChannel?: () => void;
  onSearchGroup?: () => void;
  onStartDM?: () => void;
  onLogout?: () => void;
  onOpenGroupIcon?: (groupId: string) => void;
}

interface SidebarIconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

const SidebarIconButton: React.FC<SidebarIconButtonProps> = ({
  icon: Icon,
  label,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-9 w-9 flex items-center justify-center rounded-md bg-transparent text-orange-300 hover:bg-orange-300 hover:text-black transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  onCreateGroup,
  onCreateChannel,
  onSearchGroup,
  onStartDM,
  onLogout,
  onOpenGroupIcon,
}) => {
  const {
    groups,
    channels,
    currentUser,
    selectedGroupId,
    selectedChannelId,
    selectedConversationId,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
    dmConversations,
  } = useAppStore();

  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(256);

  const maxWidth = Math.max(150, window.innerWidth - 150);
  const minSnap = 100;
  const collapsedWidth = 50;
  const newWidth = Math.max(collapsedWidth, Math.min(maxWidth, sidebarWidth));
  const isCollapsed = newWidth <= collapsedWidth + 1;
  const showLabels = !isCollapsed;

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

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const groupChannels = selectedGroupId ? channels[selectedGroupId] || [] : [];

  // Load user avatar URL
  useEffect(() => {
    const loadUserAvatar = async () => {
      if (!currentUser) {
        setUserAvatarUrl(null);
        return;
      }

      try {
        // Get user data from service (Turso DB)
        const { getServiceUserData } = await import("../../services/api");
        const userData = await getServiceUserData();

        // Load avatar from service
        if (userData.avatar_url) {
          try {
            const { getFileDownloadUrl } = await import(
              "../../services/r2-upload"
            );
            const downloadUrl = await getFileDownloadUrl(userData.avatar_url);
            setUserAvatarUrl(downloadUrl);
          } catch (error) {
            console.error("Failed to get avatar download URL:", error);
            setUserAvatarUrl(null);
          }
        } else {
          setUserAvatarUrl(null);
        }
      } catch (error) {
        console.error("Failed to load user avatar:", error);
        setUserAvatarUrl(null);
      }
    };

    loadUserAvatar();
  }, [currentUser]);

  return (
    <div
      className="h-full bg-black border-r border-orange-300/20 flex flex-col relative"
      style={{ width: `${newWidth}px` }}
    >
      {/* Header */}
      <div
        className={`border-b border-orange-300/20 ${
          isCollapsed ? "p-2" : "p-4"
        }`}
      >
        <button
          onClick={() => {
            setSelectedGroupId(null);
            setSelectedChannelId(null);
            setSelectedConversationId(null);
            if (typeof window !== "undefined") {
              window.history.pushState({ path: "/" }, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
          }}
          className="flex items-center justify-start hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Go to home"
        >
          <img
            src={logo}
            alt="Pollis"
            className={`${
              isCollapsed ? "h-8 w-8" : "h-6 w-auto"
            } flex-shrink-0 ${!isCollapsed ? "mb-3" : ""}`}
            aria-label="Pollis logo"
          />
        </button>
      </div>

      {/* Actions */}
      <div
        className={`border-b border-orange-300/20 ${
          isCollapsed ? "p-2" : "p-2"
        }`}
      >
        <div
          className={`${
            isCollapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center gap-2"
          }`}
        >
          <SidebarIconButton
            icon={Plus}
            label="Create group"
            onClick={onCreateGroup}
          />
          <SidebarIconButton
            icon={Search}
            label="Search groups (Cmd/Ctrl+K)"
            onClick={onSearchGroup}
          />
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          !isCollapsed && (
            <div className="p-4 text-center">
              <Paragraph size="sm" className="text-orange-300/50">
                No groups yet. Create one to get started.
              </Paragraph>
            </div>
          )
        ) : (
          <div className={isCollapsed ? "py-2 space-y-1" : "py-2"}>
            {groups.map((group) => (
              <div key={group.id} className={isCollapsed ? "" : "mb-2"}>
                <button
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    updateURL(`/g/${group.slug}`);
                  }}
                  className={`group ${
                    isCollapsed
                      ? "w-9 h-9 flex items-center justify-center mx-auto rounded-md hover:bg-orange-300/10 transition-colors"
                      : "w-full px-4 py-2 text-left hover:bg-orange-300/10 transition-colors"
                  } ${
                    selectedGroupId === group.id
                      ? isCollapsed
                        ? "bg-orange-300/20"
                        : "bg-orange-300/20 border-l-2 border-orange-300"
                      : ""
                  }`}
                  title={isCollapsed ? group.name : undefined}
                >
                  {isCollapsed ? (
                    <div className="w-6 h-6 rounded bg-orange-300/20 flex items-center justify-center overflow-hidden">
                      {group.icon_url ? (
                        <img
                          src={group.icon_url}
                          alt={group.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-orange-300 font-bold text-xs">
                          {group.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {group.icon_url ? (
                        <img
                          src={group.icon_url}
                          alt={group.name}
                          className="w-6 h-6 rounded flex-shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-orange-300/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-orange-300 font-bold text-xs">
                            {group.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <Header
                        size="sm"
                        className="text-orange-300 flex-1 min-w-0 truncate"
                      >
                        {group.name}
                      </Header>
                      {onOpenGroupIcon && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenGroupIcon(group.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-all"
                          aria-label={`Change icon for ${group.name}`}
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </button>

                {/* Channels for this group */}
                {selectedGroupId === group.id && !isCollapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {onCreateChannel && (
                      <button
                        onClick={onCreateChannel}
                        className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-orange-300/10 transition-colors rounded text-orange-300/70 text-sm"
                        aria-label="Create channel"
                      >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="font-mono">Create Channel</span>
                      </button>
                    )}

                    {groupChannels.length === 0 ? (
                      <div className="px-4 py-2">
                        <Paragraph size="sm" className="text-orange-300/50">
                          No channels. Create one?
                        </Paragraph>
                      </div>
                    ) : (
                      groupChannels.map((channel) => {
                        const channelSlug = deriveSlug(channel.name);
                        return (
                          <button
                            key={channel.id}
                            onClick={() => {
                              setSelectedChannelId(channel.id);
                              updateURL(`/g/${group.slug}/${channelSlug}`);
                            }}
                            className={`w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-orange-300/10 transition-colors rounded ${
                              selectedChannelId === channel.id
                                ? "bg-orange-300/20 text-orange-300"
                                : "text-orange-300/80"
                            }`}
                            aria-label={`Channel ${channel.name}`}
                          >
                            <Hash className="w-4 h-4 flex-shrink-0" />
                            <span className="font-mono text-sm truncate">
                              {channel.name}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Direct Messages Section */}
      <div className="border-t border-orange-300/20">
        {!isCollapsed && (
          <div className="p-2 border-b border-orange-300/10">
            <Header size="sm" className="px-2 text-orange-300/80">
              Direct Messages
            </Header>
          </div>
        )}
        <div
          className={`max-h-48 overflow-y-auto ${
            isCollapsed ? "p-2 space-y-1" : ""
          }`}
        >
          {dmConversations.length === 0 ? (
            !isCollapsed && (
              <div className="p-4 text-center">
                <Paragraph size="sm" className="text-orange-300/50">
                  No direct messages yet.
                </Paragraph>
              </div>
            )
          ) : (
            <div className={isCollapsed ? "space-y-1" : "py-1"}>
              {dmConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversationId(conv.id);
                    updateURL(`/c/${conv.id}`);
                  }}
                  className={`flex items-center gap-2 hover:bg-orange-300/10 transition-colors rounded-md ${
                    isCollapsed
                      ? "w-9 h-9 justify-center text-orange-300/80 mx-auto"
                      : "w-full px-4 py-2 text-left text-orange-300/80"
                  } ${
                    selectedConversationId === conv.id
                      ? "bg-orange-300/20 text-orange-300"
                      : ""
                  }`}
                  title={isCollapsed ? conv.user2_identifier : undefined}
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-mono text-sm truncate">
                      {conv.user2_identifier}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {onStartDM && (
            <button
              onClick={onStartDM}
              className={`flex items-center gap-2 hover:bg-orange-300/10 transition-colors text-orange-300/70 text-sm rounded-md ${
                isCollapsed
                  ? "w-9 h-9 justify-center mx-auto"
                  : "w-full px-4 py-2 justify-start"
              }`}
              aria-label="Start direct message"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="font-mono">Start DM</span>}
            </button>
          )}
        </div>
      </div>

      {/* User Profile and Logout */}
      {currentUser && (
        <div
          className={`border-t border-orange-300/20 ${
            isCollapsed ? "p-2 space-y-2" : "p-2 space-y-2"
          }`}
        >
          {/* User Profile */}
          {!isCollapsed && (
            <button
              onClick={() => {
                updateURL("/settings");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="flex items-center gap-3 w-full hover:bg-orange-300/15 rounded-md p-2 -ml-2 transition-colors group"
              aria-label="User settings"
            >
              <div className="relative w-10 h-10 rounded-full bg-orange-300/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt="User avatar"
                    className="w-full h-full object-cover"
                    onError={() => setUserAvatarUrl(null)}
                  />
                ) : (
                  <User className="w-5 h-5 text-orange-300" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-sans text-orange-300 font-medium truncate">
                  User
                </div>
                <div className="text-xs text-orange-300/50 truncate">
                  {currentUser.id.substring(0, 8)}...
                </div>
              </div>
              <Settings className="w-4 h-4 text-orange-300/50 group-hover:text-orange-300 transition-colors flex-shrink-0" />
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={() => {
                updateURL("/settings");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="relative w-8 h-8 rounded-full bg-orange-300/20 flex items-center justify-center hover:bg-orange-300/30 transition-colors group mx-auto overflow-hidden"
              aria-label="User settings"
            >
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt="User avatar"
                  className="w-full h-full object-cover"
                  onError={() => setUserAvatarUrl(null)}
                />
              ) : (
                <User className="w-4 h-4 text-orange-300" />
              )}
            </button>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className={`flex items-center gap-2 text-orange-300/70 hover:text-orange-300 rounded-md hover:bg-orange-300/10 transition-colors focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black ${
                isCollapsed
                  ? "w-9 h-9 justify-center mx-auto"
                  : "w-full px-4 py-2 justify-start"
              }`}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              {!isCollapsed && "Logout"}
            </button>
          )}
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-orange-300/10 hover:bg-orange-300/30"
        aria-label="Resize sidebar"
      />
    </div>
  );
};
