import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { DirectMessagesList } from "./DirectMessagesList";
import {
  applyAccentColor,
  applyFontSize,
  readAccentHex,
  readFontSizePx,
} from "../../utils/colorUtils";
import type { RightTab } from "./RouterLayout";

const MIN_CLOSE = 150;

interface RightSidebarProps {
  open: boolean;
  width: number;
  activeTab: RightTab;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  onStartDM?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  open,
  width,
  activeTab,
  onWidthChange,
  onClose,
  onStartDM,
}) => {
  const { currentUser, dmConversations, selectedConversationId, setSelectedConversationId } =
    useAppStore();

  // Resize drag — left edge, so dragging left widens, dragging right narrows
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

    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) {
        return;
      }
      // Dragging left (negative delta) increases width
      const next = startWidthRef.current - (e.clientX - startXRef.current);
      if (next < MIN_CLOSE) {
        onClose();
        isResizingRef.current = false;
        return;
      }
      onWidthChange(Math.min(next, maxWidth));
    };

    const onUp = () => { isResizingRef.current = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange, onClose]);

  const [fontSize, setFontSize] = useState(() => String(readFontSizePx()));
  const [accentColor, setAccentColor] = useState(() => readAccentHex());

  const savePreferences = (newFontSize: string, newColor: string) => {
    if (!currentUser) {
      return;
    }
    const prefs = { font_size: newFontSize, accent_color: newColor };
    invoke("save_preferences", {
      userId: currentUser.id,
      preferencesJson: JSON.stringify(prefs),
    }).catch(() => {});
  };

  const handleFontSizeChange = (raw: string) => {
    setFontSize(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 10 && n <= 28) {
      applyFontSize(n);
      savePreferences(raw, accentColor);
    }
  };

  const handleColorChange = (hex: string) => {
    setAccentColor(hex);
    applyAccentColor(hex);
    savePreferences(fontSize, hex);
  };

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="right-sidebar"
      className="flex flex-col h-full flex-shrink-0 relative"
      style={{
        width,
        background: "var(--c-surface)",
        borderLeft: "1px solid var(--c-border)",
      }}
    >
      {/* Resize handle — left edge */}
      <div
        data-testid="right-sidebar-resize-handle"
        onMouseDown={handleMouseDown}
        aria-label="Resize right sidebar"
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize z-10"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--c-border-active)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      />
      {/* DMs panel */}
      {activeTab === "dms" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <DirectMessagesList
            conversations={dmConversations}
            selectedConversationId={selectedConversationId}
            isCollapsed={false}
            onSelectConversation={(id) => setSelectedConversationId(id)}
            onStartDM={onStartDM}
          />
        </div>
      )}

      {/* Preferences panel */}
      {activeTab === "preferences" && (
        <div
          data-testid="appearance-controls"
          className="flex-1 overflow-y-auto min-h-0 px-3 py-3 flex flex-col gap-4"
        >
          <div className="section-label px-0 pb-1" style={{ borderBottom: "1px solid var(--c-border)" }}>
            Appearance
          </div>

          {/* Font size */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="right-sidebar-font-size"
              className="section-label px-0"
            >
              Font size
            </label>
            <div className="flex items-center gap-2">
              <input
                id="right-sidebar-font-size"
                data-testid="right-sidebar-font-size-input"
                type="text"
                inputMode="numeric"
                value={fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                className="pollis-input font-mono w-20"
              />
              <span className="text-2xs font-mono" style={{ color: "var(--c-text-muted)" }}>
                px (10–28)
              </span>
            </div>
          </div>

          {/* Accent color */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="right-sidebar-accent-color"
              className="section-label px-0"
            >
              Accent color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="right-sidebar-accent-color"
                data-testid="right-sidebar-accent-color-input"
                type="color"
                value={accentColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
                style={{
                  border: "1px solid var(--c-border)",
                  background: "none",
                  padding: "2px",
                }}
              />
              <span className="text-2xs font-mono" style={{ color: "var(--c-text-muted)" }}>
                {accentColor.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
