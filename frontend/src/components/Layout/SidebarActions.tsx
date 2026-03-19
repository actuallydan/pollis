import React from "react";
import { Plus, Search, LucideIcon } from "lucide-react";

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
}) => (
  <button
    data-testid={testId}
    type="button"
    onClick={onClick}
    aria-label={label}
    className="icon-btn"
  >
    <Icon size={17} aria-hidden="true" />
  </button>
);

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  isCollapsed,
  onCreateGroup,
  onSearchGroup,
  onHomeClick,
}) => (
  <div
    data-testid="sidebar-actions"
    className="flex items-center px-3 py-2.5 gap-1.5 divider"
    style={{ borderTop: 'none' }}
  >
    {/* Logo / wordmark */}
    <button
      data-testid="sidebar-home-button"
      onClick={onHomeClick}
      aria-label="Go to home"
      className="flex-1 text-left"
    >
      {isCollapsed ? (
        <span className="font-mono font-bold text-accent text-sm">P</span>
      ) : (
        <span className="font-mono font-bold text-accent text-sm tracking-tight">Pollis.</span>
      )}
    </button>

    {/* Actions */}
    {!isCollapsed && (
      <>
        <SidebarIconButton
          icon={Plus}
          label="Create group"
          testId="sidebar-create-group-button"
          onClick={onCreateGroup}
        />
        <SidebarIconButton
          icon={Search}
          label="Search groups"
          testId="sidebar-search-groups-button"
          onClick={onSearchGroup}
        />
      </>
    )}
  </div>
);
