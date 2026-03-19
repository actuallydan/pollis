import React, { useEffect, useState } from "react";
import { Outlet, useRouter } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./Sidebar";
import { RightSidebar } from "./RightSidebar";
import { TopBar } from "./TopBar";
import { useAppStore } from "../../stores/appStore";
import {
  useUserGroupsWithChannels,
  useDMConversations,
} from "../../hooks/queries";
import { applyAccentColor, applyFontSize } from "../../utils/colorUtils";

export type RightTab = "dms" | "preferences";

const LEFT_DEFAULT = 220;
const LEFT_COLLAPSED = 44;
const RIGHT_DEFAULT = 260;

interface RouterLayoutProps {
  onLogout: () => void;
}

export const RouterLayout: React.FC<RouterLayoutProps> = ({ onLogout }) => {
  const router = useRouter();
  const { setGroups, setChannels, setDMConversations, currentUser } = useAppStore();

  // Load and apply user preferences (accent color, font size) on auth
  useEffect(() => {
    if (!currentUser) {
      return;
    }
    invoke<string>("get_preferences", { userId: currentUser.id })
      .then((json) => {
        try {
          const prefs = JSON.parse(json) as Record<string, string>;
          if (prefs.font_size) {
            const n = parseInt(prefs.font_size, 10);
            if (!isNaN(n) && n >= 10 && n <= 28) {
              applyFontSize(n);
            }
          }
          if (prefs.accent_color) {
            applyAccentColor(prefs.accent_color);
          }
        } catch {
          // malformed JSON — ignore
        }
      })
      .catch(() => {
        // offline or table not yet created — use defaults
      });
  }, [currentUser?.id]);

  // ── Remote data sync ───────────────────────────────────────────
  const { data: groupsWithChannels } = useUserGroupsWithChannels();
  useEffect(() => {
    if (!groupsWithChannels) {
      return;
    }
    setGroups(groupsWithChannels);
    for (const g of groupsWithChannels) {
      setChannels(g.id, g.channels);
    }
  }, [groupsWithChannels, setGroups, setChannels]);

  const { data: dmConversations } = useDMConversations();
  useEffect(() => {
    if (dmConversations) {
      setDMConversations(dmConversations);
    }
  }, [dmConversations, setDMConversations]);

  // ── Sidebar state ──────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const leftCollapsed = leftWidth <= LEFT_COLLAPSED + 1;

  const [rightOpen, setRightOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [rightTab, setRightTab] = useState<RightTab>("dms");

  const handleToggleLeft = () => {
    setLeftWidth(leftCollapsed ? LEFT_DEFAULT : LEFT_COLLAPSED);
  };

  const handleToggleRight = () => {
    setRightOpen((p) => !p);
  };

  // Clicking a right nav icon: open sidebar (if closed) and switch to that tab
  const handleRightTabSelect = (tab: RightTab) => {
    setRightTab(tab);
    if (!rightOpen) {
      setRightOpen(true);
    }
  };

  // ── Navigation helpers ─────────────────────────────────────────
  const go = (to: string) => router.navigate({ to } as any);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <TopBar
        leftWidth={leftWidth}
        leftCollapsed={leftCollapsed}
        rightOpen={rightOpen}
        rightWidth={rightWidth}
        rightTab={rightTab}
        onToggleLeft={handleToggleLeft}
        onToggleRight={handleToggleRight}
        onRightTabSelect={handleRightTabSelect}
        onCreateGroup={() => go("/create-group")}
        onSearchGroup={() => go("/search-group")}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          width={leftWidth}
          onWidthChange={setLeftWidth}
          onCreateChannel={() => go("/create-channel")}
          onStartDM={() => go("/start-dm")}
          onLogout={onLogout}
        />

        <Outlet />

        <RightSidebar
          open={rightOpen}
          width={rightWidth}
          activeTab={rightTab}
          onWidthChange={setRightWidth}
          onClose={() => setRightOpen(false)}
          onStartDM={() => go("/start-dm")}
        />
      </div>
    </div>
  );
};
