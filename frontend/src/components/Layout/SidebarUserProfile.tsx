import React from "react";
import { LogOut, User, Settings } from "lucide-react";
import { updateURL } from "../../utils/urlRouting";

interface CurrentUser {
  id: string;
}

interface SidebarUserProfileProps {
  currentUser: CurrentUser | null;
  username: string | null;
  userAvatarUrl: string | null;
  isCollapsed: boolean;
  onAvatarError: () => void;
  onLogout?: () => void;
}

export const SidebarUserProfile: React.FC<SidebarUserProfileProps> = ({
  currentUser,
  username,
  userAvatarUrl,
  isCollapsed,
  onAvatarError,
  onLogout,
}) => {
  if (!currentUser) {
    return null;
  }

  const navigate = () => {
    updateURL("/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const Avatar = () => (
    <div
      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface-high)' }}
    >
      {userAvatarUrl ? (
        <img
          data-testid="user-avatar"
          src={userAvatarUrl}
          alt="User avatar"
          onError={onAvatarError}
          className="w-full h-full object-cover"
        />
      ) : (
        <User size={15} aria-hidden="true" style={{ color: 'var(--c-text-dim)' }} />
      )}
    </div>
  );

  return (
    <div
      data-testid="sidebar-user-profile"
      className="divider"
    >
      {!isCollapsed ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            data-testid="user-settings-button"
            onClick={navigate}
            aria-label="User settings"
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <Avatar />
            <div className="flex-1 min-w-0">
              <div
                data-testid="sidebar-username"
                className="text-xs font-mono truncate"
                style={{ color: 'var(--c-accent)' }}
              >
                {username || "user"}
              </div>
              <div
                data-testid="sidebar-user-handle"
                className="text-2xs font-mono truncate"
                style={{ color: 'var(--c-text-muted)' }}
              >
                {username ? `@${username}` : currentUser.id.slice(0, 8)}
              </div>
            </div>
            <Settings size={15} aria-hidden="true" style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
          </button>

          {onLogout && (
            <button
              data-testid="logout-button"
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className="icon-btn flex-shrink-0"
              style={{ width: 20, height: 20 }}
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-2">
          <button
            data-testid="user-settings-button-collapsed"
            onClick={navigate}
            aria-label="User settings"
            className="icon-btn"
          >
            <Avatar />
          </button>
          {onLogout && (
            <button
              data-testid="logout-button"
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className="icon-btn"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
