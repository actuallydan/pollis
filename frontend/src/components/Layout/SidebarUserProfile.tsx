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

  return (
    <div data-testid="sidebar-user-profile">
      {!isCollapsed && (
        <button
          data-testid="user-settings-button"
          onClick={() => {
            updateURL("/settings");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          aria-label="User settings"
        >
          <div data-testid="user-avatar-container">
            {userAvatarUrl ? (
              <img
                data-testid="user-avatar"
                src={userAvatarUrl}
                alt="User avatar"
                onError={onAvatarError}
              />
            ) : (
              <User aria-hidden="true" />
            )}
          </div>
          <div>
            <div data-testid="sidebar-username">{username || "User"}</div>
            <div data-testid="sidebar-user-handle">
              {username ? `@${username}` : `${currentUser.id}`}
            </div>
          </div>
          <Settings aria-hidden="true" />
        </button>
      )}

      {isCollapsed && (
        <button
          data-testid="user-settings-button-collapsed"
          onClick={() => {
            updateURL("/settings");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          aria-label="User settings"
        >
          {userAvatarUrl ? (
            <img
              data-testid="user-avatar-collapsed"
              src={userAvatarUrl}
              alt="User avatar"
              onError={onAvatarError}
            />
          ) : (
            <User aria-hidden="true" />
          )}
        </button>
      )}

      {onLogout && (
        <button
          data-testid="logout-button"
          type="button"
          onClick={onLogout}
          aria-label="Logout"
        >
          <LogOut aria-hidden="true" />
          {!isCollapsed && "Logout"}
        </button>
      )}
    </div>
  );
};
