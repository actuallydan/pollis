import React, { useEffect, useCallback, useState } from "react";
import { exit } from "@tauri-apps/plugin-process";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { TitleBar } from "./Layout/TitleBar";
import { TerminalMenu, type TerminalMenuItem } from "./ui/TerminalMenu";
import { MainContent } from "./Layout/MainContent";
import { Settings } from "../pages/Settings";
import { Preferences } from "../pages/Preferences";
import { CreateGroup } from "../pages/CreateGroup";
import { CreateChannel } from "../pages/CreateChannel";
import { SearchGroup } from "../pages/SearchGroup";
import { StartDM } from "../pages/StartDM";
import { Invites } from "../pages/Invites";
import { JoinRequests } from "../pages/JoinRequests";
import { InviteMember } from "../pages/InviteMember";
import { useAppStore } from "../stores/appStore";
import { useUserGroupsWithChannels, usePendingInvites } from "../hooks/queries/useGroups";
import { LoadingSpinner } from "./ui/LoaderSpinner";
import { useDMConversations } from "../hooks/queries/useMessages";
import { useLiveKitRealtime } from "../hooks/useLiveKitRealtime";
import type { GroupWithChannels } from "../services/api";
import type { DMConversation } from "../types";

// ─── View types ───────────────────────────────────────────────────────────────

type View =
  | { type: "root" }
  | { type: "groups" }
  | { type: "group"; group: GroupWithChannels }
  | { type: "channel" }
  | { type: "dms" }
  | { type: "dm" }
  | { type: "start-dm" }
  | { type: "create-group" }
  | { type: "search-group" }
  | { type: "create-channel" }
  | { type: "preferences" }
  | { type: "settings" }
  | { type: "invites" }
  | { type: "join-requests"; group: GroupWithChannels }
  | { type: "invite-member"; group: GroupWithChannels };

// ─── TerminalApp ──────────────────────────────────────────────────────────────

interface TerminalAppProps {
  onLogout: () => void;
}

export const TerminalApp: React.FC<TerminalAppProps> = ({ onLogout }) => {
  const [viewStack, setViewStack] = React.useState<View[]>([{ type: "root" }]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const {
    currentUser,
    selectedGroupId,
    selectedChannelId,
    channels,
    selectedConversationId,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
    setGroups,
    setChannels,
  } = useAppStore();

  const { data: groupsWithChannels, isLoading: groupsLoading, error: groupsError } = useUserGroupsWithChannels();
  const { data: dmConversations = [] } = useDMConversations();
  const { data: pendingInvites = [] } = usePendingInvites();

  console.log("about to use livekit realtime hook with selectedChannelId", selectedChannelId);
  // Maintain a LiveKit room connection for the active channel/conversation
  useLiveKitRealtime();

  // Sync groups+channels into the store once loaded
  useEffect(() => {
    if (!groupsWithChannels) {
      return;
    }
    setGroups(groupsWithChannels);
    for (const g of groupsWithChannels) {
      setChannels(g.id, g.channels);
    }
  }, [groupsWithChannels, setGroups, setChannels]);

  const currentView = viewStack[viewStack.length - 1];

  const push = useCallback((view: View) => {
    setViewStack((prev) => [...prev, view]);
  }, []);

  const pop = useCallback(() => {
    setViewStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  // Global Esc handler
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pop();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [pop]);

  // Cmd/Ctrl+R — refetch all queries without a page reload
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "r" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSyncing(true);
        queryClient.invalidateQueries().finally(() => setIsSyncing(false));
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [queryClient]);

  // Auto-focus when the window gains focus (e.g. switching back from another app)
  useEffect(() => {
    const handleWindowFocus = () => {
      if (!document.activeElement || document.activeElement === document.body) {
        const menu = document.querySelector<HTMLElement>('[role="menu"]');
        if (menu) {
          menu.focus();
          return;
        }
        const input = document.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea'
        );
        input?.focus();
      }
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const goBackItem: TerminalMenuItem = {
    id: "__back__",
    label: "← Go back",
    action: pop,
    type: "system",
  };

  const renderRootMenu = () => {
    const items: TerminalMenuItem[] = [
      {
        id: "groups",
        label: "Groups",
        description: groupsLoading
          ? "Loading…"
          : groupsWithChannels
            ? `${groupsWithChannels.length} group${groupsWithChannels.length !== 1 ? "s" : ""}`
            : "No groups yet",
        action: () => push({ type: "groups" }),
        testId: "menu-item-groups",
      },
      {
        id: "dms",
        label: "Direct Messages",
        description: dmConversations.length > 0
          ? `${dmConversations.length} conversation${dmConversations.length !== 1 ? "s" : ""}`
          : "Start a new conversation",
        action: () => push({ type: "dms" }),
        testId: "menu-item-dms",
      },
      {
        id: "invites",
        label: "Invites",
        description: pendingInvites.length > 0
          ? `${pendingInvites.length} pending`
          : "No pending invites",
        action: () => push({ type: "invites" }),
        type: "system" as const,
        testId: "menu-item-invites",
      },
      { id: "__sep1__", label: "", type: "separator" },
      {
        id: "preferences",
        label: "Preferences",
        description: "Colors, font size",
        action: () => push({ type: "preferences" }),
        type: "system",
        testId: "menu-item-preferences",
      },
      {
        id: "settings",
        label: "Settings",
        description: currentUser ? currentUser.email : undefined,
        action: () => push({ type: "settings" }),
        type: "system",
        testId: "menu-item-settings",
      },
      {
        id: "exit",
        label: "Exit",
        action: () => exit(0),
        type: "system",
        testId: "menu-item-exit",
      },
      {
        id: "logout",
        label: "Log out",
        action: onLogout,
        type: "system",
        testId: "menu-item-logout",
      },
    ];

    return <TerminalMenu items={items} />
;
  };

  const renderGroupsMenu = () => {
    const groups = groupsWithChannels ?? [];

    const groupItems: TerminalMenuItem[] = groupsLoading
      ? [{ id: "__loading__", label: "Loading…", disabled: true }]
      : groupsError
        ? [{ id: "__error__", label: `Error: ${groupsError instanceof Error ? groupsError.message : "Failed to load"}`, disabled: true }]
        : groups.map((g) => ({
            id: g.id,
            label: g.name,
            description: g.description || undefined,
            action: () => {
              setSelectedGroupId(g.id);
              push({ type: "group" as const, group: g });
            },
            testId: `group-option-${g.id}`,
          }));

    const items: TerminalMenuItem[] = [
      ...groupItems,
      { id: "__sep__", label: "", type: "separator" },
      {
        id: "create-group",
        label: "Create Group",
        action: () => push({ type: "create-group" }),
        type: "system",
        testId: "menu-item-create-group",
      },
      {
        id: "search-group",
        label: "Find Group",
        action: () => push({ type: "search-group" }),
        type: "system",
        testId: "menu-item-find-group",
      },
      goBackItem,
    ];

    return <TerminalMenu items={items} onEsc={pop} />
;
  };

  const renderGroupMenu = (group: GroupWithChannels) => {
    const channels = group.channels ?? [];
    const items: TerminalMenuItem[] = [
      ...channels.map((ch) => ({
        id: ch.id,
        label: `# ${ch.name}`,
        description: ch.description || undefined,
        action: () => {
          setSelectedChannelId(ch.id);
          push({ type: "channel" as const });
        },
        testId: `channel-option-${ch.id}`,
      })),
      { id: "__sep__", label: "", type: "separator" as const },
      {
        id: "create-channel",
        label: "+ New Channel",
        action: () => {
          setSelectedGroupId(group.id);
          push({ type: "create-channel" });
        },
        type: "system" as const,
        testId: "menu-item-create-channel",
      },
      {
        id: "invite-member",
        label: "Invite Member",
        action: () => push({ type: "invite-member", group }),
        type: "system" as const,
        testId: "menu-item-invite-member",
      },
      {
        id: "join-requests",
        label: "Join Requests",
        action: () => push({ type: "join-requests", group }),
        type: "system" as const,
        testId: "menu-item-join-requests",
      },
      goBackItem,
    ];

    return <TerminalMenu items={items} onEsc={pop} />
;
  };

  const renderDMsMenu = (conversations: DMConversation[]) => {
    const items: TerminalMenuItem[] = [
      ...conversations.map((c) => ({
        id: c.id,
        label: c.user2_identifier,
        action: () => {
          setSelectedConversationId(c.id);
          push({ type: "dm" as const });
        },
        testId: `dm-option-${c.id}`,
      })),
      { id: "__sep__", label: "", type: "separator" as const },
      {
        id: "new-dm",
        label: "New Message",
        action: () => push({ type: "start-dm" }),
        type: "system" as const,
        testId: "menu-item-new-dm",
      },
      goBackItem,
    ];

    return <TerminalMenu items={items} onEsc={pop} />
;
  };

  // ─── View title for TopBar display ──────────────────────────────────────────

  const viewTitle = (): string => {
    switch (currentView.type) {
      case "root": return "pollis";
      case "groups": return "Groups";
      case "group": return currentView.group.name;
      case "channel": {
        const groupChannels = selectedGroupId ? (channels[selectedGroupId] ?? []) : [];
        const ch = groupChannels.find((c) => c.id === selectedChannelId);
        return ch ? `Channel : : ${ch.name}` : "Channel";
      }
      case "dms": return "Direct Messages";
      case "dm": {
        const conv = dmConversations.find((c) => c.id === selectedConversationId);
        return conv ? `dm : : @${conv.user2_identifier}` : "dm";
      }
      case "create-group": return "Create Group";
      case "search-group": return "Find Group";
      case "create-channel": return "New Channel";
      case "start-dm": return "New Message";
      case "preferences": return "Preferences";
      case "settings": return "Settings";
      case "invites": return "Invites";
      case "join-requests": return `Join Requests : : ${currentView.group.name}`;
      case "invite-member": return `Invite Member : : ${currentView.group.name}`;
      default: return "pollis";
    }
  };

  // ─── Content area ───────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (currentView.type) {
      case "root":
        return renderRootMenu();
      case "groups":
        return renderGroupsMenu();
      case "group":
        return renderGroupMenu(currentView.group);
      case "channel":
        return (
          <div className="flex flex-col h-full">
            <div
              className="flex items-center px-4 py-2 flex-shrink-0 text-xs font-mono"
              style={{
                borderBottom: "1px solid var(--c-border)",
                color: "var(--c-text-muted)",
              }}
            >
              <button
                onClick={pop}
                className="mr-3 inline-flex items-center gap-1 leading-none transition-colors"
                style={{ color: "var(--c-text-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-text-muted)"; }}
              >
                <ArrowLeft size={12} />
              </button>
              <span>{viewTitle()}</span>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <MainContent />
            </div>
          </div>
        );
      case "dms":
        return renderDMsMenu(dmConversations);
      case "dm":
        return (
          <div className="flex flex-col h-full">
            <div
              className="flex items-center px-4 py-2 flex-shrink-0 text-xs font-mono"
              style={{
                borderBottom: "1px solid var(--c-border)",
                color: "var(--c-text-muted)",
              }}
            >
              <button
                onClick={pop}
                className="mr-3 inline-flex items-center gap-1 leading-none transition-colors"
                style={{ color: "var(--c-text-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-text-muted)"; }}
              >
                <ArrowLeft size={12} />
              </button>
              <span>Direct Message{(() => { const conv = dmConversations.find((c) => c.id === selectedConversationId); return conv ? ` : : @${conv.user2_identifier}` : ""; })()}</span>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <MainContent />
            </div>
          </div>
        );
      case "create-group":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="Create Group" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <CreateGroup onSuccess={() => pop()} />
            </div>
          </div>
        );
      case "search-group":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="Find Group" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <SearchGroup />
            </div>
          </div>
        );
      case "create-channel":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="New Channel" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <CreateChannel onSuccess={(channelId) => {
                if (channelId) {
                  // Channel was created — pop back to the group and open the channel
                  pop();
                  push({ type: "channel" });
                } else {
                  pop();
                }
              }} />
            </div>
          </div>
        );
      case "start-dm":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="New Message" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <StartDM onSuccess={(conversationId) => {
                setSelectedConversationId(conversationId);
                // Replace the start-dm view with the conversation
                pop();
                push({ type: "dm" });
              }} />
            </div>
          </div>
        );
      case "preferences":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="Preferences" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <Preferences />
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader
              title="Settings"
              onBack={pop}
              rightAction={
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => exit(0)}
                    className="text-xs font-mono transition-colors"
                    style={{ color: "var(--c-text-muted)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-text-dim)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-text-muted)"; }}
                  >
                    Exit
                  </button>
                  <button
                    onClick={onLogout}
                    className="text-xs font-mono transition-colors"
                    style={{ color: "var(--c-text-muted)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ff6b6b"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-text-muted)"; }}
                  >
                    Log out
                  </button>
                </div>
              }
            />
            <div className="flex-1 overflow-hidden">
              <Settings />
            </div>
          </div>
        );
      case "invites":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="Invites" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <Invites />
            </div>
          </div>
        );
      case "join-requests":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="Join Requests" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <JoinRequests groupId={currentView.group.id} groupName={currentView.group.name} />
            </div>
          </div>
        );
      case "invite-member":
        return (
          <div className="flex flex-col h-full">
            <MenuPageHeader title="Invite Member" onBack={pop} />
            <div className="flex-1 overflow-hidden">
              <InviteMember groupId={currentView.group.id} groupName={currentView.group.name} />
            </div>
          </div>
        );
      default:
        return renderRootMenu();
    }
  };

  return (
    <div
      data-testid="terminal-app"
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--c-bg)",
        position: "relative",
      }}
    >
      {/* Title bar */}
      <TitleBar />

      {/* Sync indicator — floats top-right below title bar */}
      {isSyncing && (
        <div
          className="flex items-center gap-1.5 text-xs font-mono pointer-events-none"
          style={{
            position: "absolute",
            top: 36 + 7,
            right: 12,
            zIndex: 50,
            color: "var(--c-accent-dim)",
          }}
        >
          <span>syncing…</span>
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {renderContent()}
      </div>

      {/* Bottom bar — reserved for notifications/shortcuts/status */}
      <div
        style={{
          height: 28,
          flexShrink: 0,
          borderTop: "1px solid var(--c-border)",
          background: "var(--c-surface)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        <span className="text-xs font-mono" style={{ color: "var(--c-text-dim)" }}>
          {viewStack
            .filter((v) => v.type !== "root")
            .map((v) => {
              switch (v.type) {
                case "groups": return "Groups";
                case "group": return v.group.name;
                case "channel": {
                  const groupChannels = selectedGroupId ? (channels[selectedGroupId] ?? []) : [];
                  const ch = groupChannels.find((c) => c.id === selectedChannelId);
                  return ch ? `Channel : : ${ch.name}` : "Channel";
                }
                case "dms": return "Direct Messages";
                case "dm": {
                  const conv = dmConversations.find((c) => c.id === selectedConversationId);
                  return conv ? `dm : : @${conv.user2_identifier}` : "dm";
                }
                case "create-group": return "Create Group";
                case "search-group": return "Find Group";
                case "create-channel": return "New Channel";
                case "start-dm": return "New Message";
                case "preferences": return "Preferences";
                case "settings": return "Settings";
                case "invites": return "Invites";
                case "join-requests": return `Join Requests : : ${v.group.name}`;
                case "invite-member": return `Invite Member : : ${v.group.name}`;
                default: return null;
              }
            })
            .filter(Boolean)
            .join(" › ")}
        </span>
      </div>
    </div>
  );
};

// ─── Small reusable page header inside terminal views ─────────────────────────

interface MenuPageHeaderProps {
  title: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
}

const MenuPageHeader: React.FC<MenuPageHeaderProps> = ({ title, onBack, rightAction }) => (
  <div
    className="flex items-center px-4 py-2 flex-shrink-0 text-xs font-mono"
    style={{
      borderBottom: "1px solid var(--c-border)",
      color: "var(--c-text-muted)",
    }}
  >
    <button
      onClick={onBack}
      className="mr-3 inline-flex items-center gap-1 leading-none transition-colors"
      style={{ color: "var(--c-text-muted)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-accent)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-text-muted)"; }}
    >
      <ArrowLeft size={12} />
    </button>
    <span style={{ flex: 1, color: "var(--c-text)" }}>{title}</span>
    {rightAction}
  </div>
);
