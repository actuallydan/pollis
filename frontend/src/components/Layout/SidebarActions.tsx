import React from "react";
import { Plus, Search, LucideIcon } from "lucide-react";
import logo from "../../assets/images/LogoBigMono.svg";

interface SidebarActionsProps {
  isCollapsed: boolean;
  onCreateGroup?: () => void;
  onSearchGroup?: () => void;
  onHomeClick: () => void;
}

interface SidebarIconButtonProps {
  icon: LucideIcon;
  label: string;
  testId: string;
  onClick?: () => void;
}

const SidebarIconButton: React.FC<SidebarIconButtonProps> = ({
  icon: Icon,
  label,
  testId,
  onClick,
}) => {
  return (
    <button
      data-testid={testId}
      type="button"
      onClick={onClick}
      aria-label={label}
    >
      <Icon aria-hidden="true" />
    </button>
  );
};

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  isCollapsed,
  onCreateGroup,
  onSearchGroup,
  onHomeClick,
}) => {
  return (
    <div data-testid="sidebar-actions">
      <div>
        <button
          data-testid="sidebar-home-button"
          onClick={onHomeClick}
          aria-label="Go to home"
        >
          <img
            src={logo}
            alt="Pollis"
            aria-label="Pollis logo"
          />
        </button>
        <SidebarIconButton
          icon={Plus}
          label="Create group"
          testId="sidebar-create-group-button"
          onClick={onCreateGroup}
        />
        <SidebarIconButton
          icon={Search}
          label="Search groups (Cmd/Ctrl+K)"
          testId="sidebar-search-groups-button"
          onClick={onSearchGroup}
        />
      </div>
    </div>
  );
};
