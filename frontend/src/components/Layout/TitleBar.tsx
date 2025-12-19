import React from "react";
import { Minus, Square, X } from "lucide-react";
import { checkIsDesktop } from "../../hooks/useWailsReady";
import logo from "../../assets/images/LogoBigMono.svg";

interface TitleBarProps {
  title?: string;
}

// Access Wails runtime through window object to avoid build-time import issues
const getRuntime = () => {
  if (typeof window === "undefined") return null;
  return (window as any).runtime;
};

export const TitleBar: React.FC<TitleBarProps> = ({ title = "Pollis" }) => {
  const isDesktop = checkIsDesktop();

  if (!isDesktop) {
    return null; // No custom title bar in browser
  }

  // Detect platform for button positioning
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const handleMinimize = () => {
    try {
      const runtime = getRuntime();
      if (runtime?.WindowMinimise) {
        runtime.WindowMinimise();
      }
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  const handleMaximize = () => {
    try {
      const runtime = getRuntime();
      if (runtime?.WindowToggleMaximise) {
        runtime.WindowToggleMaximise();
      }
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  const handleClose = () => {
    try {
      const runtime = getRuntime();
      if (runtime?.Quit) {
        runtime.Quit();
      }
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  return (
    <div
      className="h-10 bg-black/80 border-b border-orange-300/20 flex items-center select-none w-full titlebar-drag"
      style={
        {
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        } as React.CSSProperties
      }
    >
      {isMac ? (
        // macOS: Traffic lights on the left, then title in center
        <>
          <div className="flex items-center gap-2 px-3 titlebar-no-drag">
            <button
              onClick={handleClose}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors group"
              aria-label="Close"
            >
              <X className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={handleMinimize}
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition-colors group"
              aria-label="Minimize"
            >
              <Minus className="w-2 h-2 text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors group"
              aria-label="Maximize"
            >
              <Square className="w-1.5 h-1.5 text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 titlebar-drag">
            <img src={logo} alt="Pollis" className="h-4 w-4" />
            <div className="text-orange-300 text-xs font-medium">{title}</div>
          </div>
          <div className="w-20 titlebar-drag" /> {/* Spacer for symmetry */}
        </>
      ) : (
        // Windows/Linux: Logo/title on left, controls on right
        <>
          <div className="flex items-center gap-2 pl-3 flex-1 titlebar-drag">
            <img src={logo} alt="Pollis" className="h-4 w-4" />
            <div className="text-orange-300 text-xs font-medium">{title}</div>
          </div>
          <div className="flex items-center gap-1 pr-2 titlebar-no-drag">
            <button
              onClick={handleMinimize}
              className="w-10 h-10 flex items-center justify-center text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
              aria-label="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-10 h-10 flex items-center justify-center text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
              aria-label="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center text-orange-300/70 hover:text-orange-300 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
