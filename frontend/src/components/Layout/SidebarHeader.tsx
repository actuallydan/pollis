import React from "react";
import logo from "../../assets/images/LogoBigMono.svg";

interface SidebarHeaderProps {
  isCollapsed: boolean;
  onHomeClick: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isCollapsed,
  onHomeClick,
}) => {
  return (
    <div
      className={`border-b border-orange-300/20 ${
        isCollapsed ? "p-2" : "p-4"
      }`}
    >
      <button
        onClick={onHomeClick}
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
  );
};
