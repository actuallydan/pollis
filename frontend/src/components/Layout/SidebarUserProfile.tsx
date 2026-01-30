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
  if (!currentUser) return null;

  return (
    <div
      className={`border-t border-orange-300/20 ${
        isCollapsed ? "p-2 space-y-2" : "p-2 space-y-2"
      }`}
    >
      {/* User Profile */}
      {!isCollapsed && (
        <button
          onClick={() => {
            updateURL("/settings");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="flex items-center gap-3 w-full hover:bg-orange-300/15 rounded-md p-2 -ml-2 transition-colors group"
          aria-label="User settings"
        >
          <div className="relative w-10 h-10 rounded-full bg-orange-300/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt="User avatar"
                className="w-full h-full object-cover"
                onError={onAvatarError}
              />
            ) : (
              <User className="w-5 h-5 text-orange-300" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="font-sans text-orange-300 font-medium truncate">
              {username || "User"}
            </div>
            <div className="text-xs text-orange-300/50 truncate">
              {username ? `@${username}` : `${currentUser.id}`}
            </div>
          </div>
          <Settings className="w-4 h-4 text-orange-300/50 group-hover:text-orange-300 transition-colors flex-shrink-0" />
        </button>
      )}
      {isCollapsed && (
        <button
          onClick={() => {
            updateURL("/settings");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="relative w-8 h-8 rounded-full bg-orange-300/20 flex items-center justify-center hover:bg-orange-300/30 transition-colors group mx-auto overflow-hidden"
          aria-label="User settings"
        >
          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
              alt="User avatar"
              className="w-full h-full object-cover"
              onError={onAvatarError}
            />
          ) : (
            <User className="w-4 h-4 text-orange-300" />
          )}
        </button>
      )}

      {/* Logout Button */}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          aria-label="Logout"
          className={`flex items-center gap-2 text-orange-300/70 hover:text-orange-300 rounded-md hover:bg-orange-300/10 transition-colors focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black ${
            isCollapsed
              ? "w-9 h-9 justify-center mx-auto"
              : "w-full px-4 py-2 justify-start"
          }`}
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          {!isCollapsed && "Logout"}
        </button>
      )}
    </div>
  );
};
