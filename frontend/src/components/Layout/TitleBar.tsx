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
      style={
        {
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        } as React.CSSProperties
      }
    >
      <div data-testid="title-bar-left">
        <img src={logo} alt="Pollis" />
        <div data-testid="title-bar-title">{title}</div>
      </div>
      <div data-testid="title-bar-controls">
        <button
          data-testid="title-bar-minimize"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <Minus aria-hidden="true" />
        </button>
        <button
          data-testid="title-bar-maximize"
          onClick={handleMaximize}
          aria-label="Maximize"
        >
          <Square aria-hidden="true" />
        </button>
        <button
          data-testid="title-bar-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
