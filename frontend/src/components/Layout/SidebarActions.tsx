import React from "react";
import { Plus, Search, LucideIcon } from "lucide-react";

interface SidebarActionsProps {
  isCollapsed: boolean;
  onCreateGroup?: () => void;
  onSearchGroup?: () => void;
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

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  isCollapsed,
  onCreateGroup,
  onSearchGroup,
}) => {
  return (
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
  );
};
