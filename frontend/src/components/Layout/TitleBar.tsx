import React from "react";
import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logo from "../../assets/images/LogoBigMono.svg";

interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = "Pollis" }) => {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  if (isMac) {
    return null;
  }

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  return (
    <div
      data-testid="title-bar"
      className="flex items-center justify-between px-3 flex-shrink-0"
      style={{
        height: 32,
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div data-testid="title-bar-left" className="flex items-center gap-2">
        <img src={logo} alt="Pollis" style={{ width: 14, height: 14, opacity: 0.7 }} />
        <span data-testid="title-bar-title" className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
          {title}
        </span>
      </div>
      <div
        data-testid="title-bar-controls"
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          data-testid="title-bar-minimize"
          onClick={handleMinimize}
          aria-label="Minimize"
          className="icon-btn-sm"
        >
          <Minus size={12} aria-hidden="true" />
        </button>
        <button
          data-testid="title-bar-maximize"
          onClick={handleMaximize}
          aria-label="Maximize"
          className="icon-btn-sm"
        >
          <Square size={12} aria-hidden="true" />
        </button>
        <button
          data-testid="title-bar-close"
          onClick={handleClose}
          aria-label="Close"
          className="icon-btn-sm"
          style={{ color: 'var(--c-text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-muted)'; }}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
