import React from "react";
import { ArrowLeft, Hash, MessageCircle, PanelLeft, PanelRight, Plus, Search, Settings, SlidersHorizontal } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useRouterState, useRouter } from "@tanstack/react-router";
import { updateURL } from "../../utils/urlRouting";
import type { RightTab } from "./RouterLayout";

interface TopBarProps {
  leftWidth: number;
  leftCollapsed: boolean;
  rightOpen: boolean;
  rightWidth: number;
  rightTab: RightTab;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onRightTabSelect: (tab: RightTab) => void;
  onCreateGroup: () => void;
  onSearchGroup: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  leftWidth,
  leftCollapsed,
  rightOpen,
  rightWidth,
  rightTab,
  onToggleLeft,
  onToggleRight,
  onRightTabSelect,
  onCreateGroup,
  onSearchGroup,
}) => {
  const {
    selectedChannelId,
    selectedConversationId,
    selectedGroupId,
    channels,
    groups,
    dmConversations,
  } = useAppStore();
  const routerState = useRouterState();
  const router = useRouter();
  const pathname = routerState.location.pathname;
  const isGroupSettings = /^\/g\/[^/]+\/settings$/.test(pathname);

  const currentChannel = selectedChannelId
    ? Object.values(channels).flat().find((c) => c.id === selectedChannelId)
    : null;

  const currentConversation = selectedConversationId
    ? dmConversations.find((c) => c.id === selectedConversationId)
    : null;

  const currentGroup = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)
    : null;

  // Page-level breadcrumb titles — routes that own no channel/group context
  const pageTitle: { label: string; sub?: string } | null = (() => {
    if (isGroupSettings) {
      return { label: currentGroup?.name ?? "", sub: "settings" };
    }
    if (pathname === "/create-channel") {
      return { label: "New Channel", sub: currentGroup ? `in ${currentGroup.name}` : undefined };
    }
    if (pathname === "/create-group") return { label: "New Group" };
    if (pathname === "/search-group") return { label: "Find Group" };
    if (pathname === "/settings") return { label: "Settings" };
    if (pathname === "/start-dm") return { label: "New Message" };
    return null;
  })();

  // Right nav icons — always rendered, just move sides of the border
  const rightNavIcons = (
    <>
      <button
        data-testid="toggle-right-sidebar-button"
        onClick={onToggleRight}
        aria-label={rightOpen ? "Close right sidebar" : "Open right sidebar"}
        className="icon-btn"
      >
        <PanelRight size={17} aria-hidden="true" />
      </button>
      <button
        data-testid="right-sidebar-nav-dms"
        onClick={() => onRightTabSelect("dms")}
        aria-label="Direct messages"
        className="icon-btn"
        style={{ color: rightOpen && rightTab === "dms" ? "var(--c-accent)" : undefined }}
      >
        <MessageCircle size={17} aria-hidden="true" />
      </button>
      <button
        data-testid="right-sidebar-nav-preferences"
        onClick={() => onRightTabSelect("preferences")}
        aria-label="Preferences"
        className="icon-btn"
        style={{ color: rightOpen && rightTab === "preferences" ? "var(--c-accent)" : undefined }}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div
      data-testid="top-bar"
      className="flex flex-shrink-0"
      style={{ height: 40, borderBottom: "1px solid var(--c-border)" }}
    >
      {/* ── Left sidebar zone ──────────────────────────────────────────
          When expanded: icons right-aligned at the inner border edge.
          When collapsed: empty surface band; icons shift to center zone. */}
      <div
        className="flex items-center justify-end gap-0.5 px-1 flex-shrink-0"
        style={{
          width: leftWidth,
          background: "var(--c-surface)",
          borderRight: "1px solid var(--c-border)",
        }}
      >
        {!leftCollapsed && (
          <>
            <button
              data-testid="sidebar-create-group-button"
              onClick={onCreateGroup}
              aria-label="Create group"
              className="icon-btn"
            >
              <Plus size={17} aria-hidden="true" />
            </button>
            <button
              data-testid="sidebar-search-groups-button"
              onClick={onSearchGroup}
              aria-label="Search groups"
              className="icon-btn"
            >
              <Search size={17} aria-hidden="true" />
            </button>
            <button
              data-testid="toggle-left-sidebar-button"
              onClick={onToggleLeft}
              aria-label="Close left sidebar"
              className="icon-btn"
            >
              <PanelLeft size={17} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* ── Center zone ────────────────────────────────────────────────
          Left icons (when sidebar collapsed) | channel info | right icons */}
      <div
        className="flex-1 flex items-center min-w-0"
        style={{ background: "var(--c-bg)" }}
      >
        {/* Left sidebar icons outside when collapsed */}
        {leftCollapsed && (
          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
            <button
              data-testid="sidebar-create-group-button"
              onClick={onCreateGroup}
              aria-label="Create group"
              className="icon-btn"
            >
              <Plus size={17} aria-hidden="true" />
            </button>
            <button
              data-testid="sidebar-search-groups-button"
              onClick={onSearchGroup}
              aria-label="Search groups"
              className="icon-btn"
            >
              <Search size={17} aria-hidden="true" />
            </button>
            <button
              data-testid="toggle-left-sidebar-button"
              onClick={onToggleLeft}
              aria-label="Open left sidebar"
              className="icon-btn"
            >
              <PanelLeft size={17} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Channel / conversation title — or page breadcrumb */}
        <div
          data-testid="channel-header"
          className="flex-1 flex items-center gap-2 px-3 min-w-0 overflow-hidden"
        >
          {pageTitle ? (
            <>
              <button
                data-testid="page-back-button"
                onClick={() => router.history.back()}
                aria-label="Back"
                className="icon-btn"
              >
                <ArrowLeft size={14} aria-hidden="true" />
              </button>
              <span
                data-testid="channel-name"
                className="text-xs font-mono font-medium truncate"
                style={{ color: "var(--c-accent)" }}
              >
                {pageTitle.label}
              </span>
              {pageTitle.sub && (
                <span className="text-xs font-mono" style={{ color: "var(--c-text-muted)" }}>
                  {pageTitle.sub}
                </span>
              )}
            </>
          ) : currentChannel ? (
            <>
              <Hash size={14} aria-hidden="true" style={{ color: "var(--c-text-dim)", flexShrink: 0 }} />
              <span
                data-testid="channel-name"
                className="text-xs font-mono font-medium truncate"
                style={{ color: "var(--c-accent)" }}
              >
                {currentChannel.name}
              </span>
              {(currentChannel as any).description && (
                <>
                  <span style={{ color: "var(--c-border-active)", flexShrink: 0 }}>·</span>
                  <span
                    data-testid="channel-description"
                    className="text-xs truncate"
                    style={{ color: "var(--c-text-dim)" }}
                  >
                    {(currentChannel as any).description}
                  </span>
                </>
              )}
            </>
          ) : currentConversation ? (
            <>
              <MessageCircle size={14} aria-hidden="true" style={{ color: "var(--c-text-dim)", flexShrink: 0 }} />
              <span
                data-testid="channel-name"
                className="text-xs font-mono font-medium truncate"
                style={{ color: "var(--c-accent)" }}
              >
                {currentConversation.user2_identifier || "Direct Message"}
              </span>
            </>
          ) : null}
        </div>

        {/* Group settings */}
        <div className="flex items-center gap-1 flex-shrink-0 px-1">
          {currentGroup && !pageTitle && (
            <button
              data-testid="group-settings-button"
              onClick={() => {
                updateURL(`/g/${currentGroup.slug}/settings`);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              aria-label="Group settings"
              className="icon-btn"
            >
              <Settings size={17} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Right sidebar icons outside when closed */}
        {!rightOpen && (
          <div className="flex items-center gap-0.5 mr-1 flex-shrink-0">
            {rightNavIcons}
          </div>
        )}
      </div>

      {/* ── Right sidebar zone ─────────────────────────────────────────
          Only rendered when open. Icons left-aligned at the inner edge. */}
      {rightOpen && (
        <div
          className="flex items-center justify-start gap-0.5 px-1 flex-shrink-0"
          style={{
            width: rightWidth,
            background: "var(--c-surface)",
            borderLeft: "1px solid var(--c-border)",
          }}
        >
          {rightNavIcons}
        </div>
      )}
    </div>
  );
};
