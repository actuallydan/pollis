import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAppStore } from "./stores/appStore";
import { Sidebar } from "./components/Layout/Sidebar";
import { MainContent } from "./components/Layout/MainContent";
import { TitleBar } from "./components/Layout/TitleBar";
import { Settings } from "./pages/Settings";
import { GroupSettings } from "./pages/GroupSettings";
import { LoadingSpinner, DotMatrix, Card, pulsingWaveAlgorithm } from "monopollis";
import {
  CreateGroupModal,
  CreateChannelModal,
  SearchGroupModal,
  StartDMModal,
  AvatarSettingsModal,
  GroupIconModal,
} from "./components/Modals";
import * as api from "./services/api";
import { useWailsReady } from "./hooks/useWailsReady";
import { useAblyRealtime } from "./hooks/useAblyRealtime";
import { parseURL, deriveSlug } from "./utils/urlRouting";

// Storage keys for state persistence
const STORAGE_KEYS = {
  SELECTED_GROUP: "pollis_selected_group",
  SELECTED_CHANNEL: "pollis_selected_channel",
  SELECTED_CONVERSATION: "pollis_selected_conversation",
} as const;

// Helper to safely get from localStorage
function getStoredSelection() {
  try {
    return {
      groupId: localStorage.getItem(STORAGE_KEYS.SELECTED_GROUP),
      channelId: localStorage.getItem(STORAGE_KEYS.SELECTED_CHANNEL),
      conversationId: localStorage.getItem(STORAGE_KEYS.SELECTED_CONVERSATION),
    };
  } catch {
    return { groupId: null, channelId: null, conversationId: null };
  }
}

// Helper to safely set localStorage
function setStoredSelection(
  key: keyof typeof STORAGE_KEYS,
  value: string | null
) {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEYS[key], value);
    } else {
      localStorage.removeItem(STORAGE_KEYS[key]);
    }
  } catch {
    // Ignore storage errors
  }
}

type AppState = "initializing" | "loading" | "clerk-auth" | "ready";

function App() {
  const { isDesktop, isReady: isWailsReady } = useWailsReady();

  // Desktop app only - browser auth is handled by desktop backend
  // The backend serves the OAuth callback pages on localhost:44665
  if (!isDesktop) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="text-red-400 mb-2">Desktop Only</div>
          <div className="text-orange-300/70 text-sm">
            This app requires the desktop application.
          </div>
        </div>
      </div>
    );
  }

  return <MainApp isDesktop={isDesktop} isWailsReady={isWailsReady} />;
}

// Main app component (desktop only)
function MainApp({
  isDesktop,
  isWailsReady,
}: {
  isDesktop: boolean;
  isWailsReady: boolean;
}) {
  const {
    currentUser,
    setCurrentUser,
    setGroups,
    setChannels,
    setDMConversations,
    setNetworkStatus,
    logout,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
    selectedGroupId,
    selectedChannelId,
    selectedConversationId,
    groups,
    channels,
    dmConversations,
  } = useAppStore();

  const [appState, setAppState] = useState<AppState>("initializing");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSearchGroup, setShowSearchGroup] = useState(false);
  const [showStartDM, setShowStartDM] = useState(false);
  const [showGroupIcon, setShowGroupIcon] = useState(false);
  const [selectedGroupForIcon, setSelectedGroupForIcon] = useState<
    string | null
  >(null);

  // Ably real-time subscriptions (manages subscriptions based on selected channel)
  useAblyRealtime();

  // Persist selection changes to localStorage
  useEffect(() => {
    setStoredSelection("SELECTED_GROUP", selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    setStoredSelection("SELECTED_CHANNEL", selectedChannelId);
  }, [selectedChannelId]);

  useEffect(() => {
    setStoredSelection("SELECTED_CONVERSATION", selectedConversationId);
  }, [selectedConversationId]);

  // Check identity helper - memoized to avoid recreating
  const checkIdentityFn = useCallback(async (): Promise<boolean> => {
    try {
      return await api.checkIdentity();
    } catch (error) {
      console.warn("checkIdentity not available:", error);
      return false;
    }
  }, []);

  // Load profile data - memoized with dependencies
  const loadProfileData = useCallback(async () => {
    try {
      // Initialize service URL if not already set (for user registration)
      const serviceURL = import.meta.env.VITE_SERVICE_URL || "localhost:50051";
      try {
        await api.setServiceURL(serviceURL);
        console.log("[App] Service URL initialized:", serviceURL);
      } catch (error) {
        console.warn(
          "[App] Failed to set service URL (service may be offline):",
          error
        );
        // Don't fail - app can work offline
      }

      const user = await api.getCurrentUser();
      if (!user) {
        setAppState("clerk-auth");
        return;
      }
      setCurrentUser(user);

      // Load user groups
      const groupsData = await api.listUserGroups(user.id);
      setGroups(groupsData);

      // Load channels for each group and store in a map for URL parsing
      const channelsByGroupId: Record<string, any[]> = {};
      for (const group of groupsData) {
        try {
          const channelsData = await api.listChannels(group.id);
          channelsByGroupId[group.id] = channelsData;
          setChannels(group.id, channelsData);
        } catch (err) {
          console.error(`Failed to load channels for group ${group.id}:`, err);
          channelsByGroupId[group.id] = [];
        }
      }

      // Load DM conversations
      const conversationsData = await api.listDMConversations(user.id);
      setDMConversations(conversationsData);

      // Parse URL first (takes priority over localStorage)
      const urlData = parseURL();

      // Handle settings routes
      if (urlData.type === "settings") {
        setSelectedGroupId(null);
        setSelectedChannelId(null);
        setSelectedConversationId(null);
        setAppState("ready");
        return;
      }

      // Handle group settings route
      if (urlData.type === "group-settings" && urlData.groupSlug) {
        const group = groupsData.find((g: any) => g.slug === urlData.groupSlug);
        if (group) {
          setSelectedGroupId(group.id);
          setSelectedChannelId(null);
          setSelectedConversationId(null);
          setAppState("ready");
          return;
        }
      }

      // Restore selection from URL if available, otherwise use localStorage
      if (
        urlData.type === "channel" &&
        urlData.groupSlug &&
        urlData.channelSlug
      ) {
        // Find group by slug
        const group = groupsData.find((g: any) => g.slug === urlData.groupSlug);
        if (group) {
          setSelectedGroupId(group.id);

          // Find channel by slug using the channels we just loaded
          const groupChannels = channelsByGroupId[group.id] || [];
          const channel = groupChannels.find(
            (c: any) => deriveSlug(c.name) === urlData.channelSlug
          );
          if (channel) {
            setSelectedChannelId(channel.id);
          }
        }
      } else if (urlData.type === "group" && urlData.groupSlug) {
        // Just group, no channel
        const group = groupsData.find((g: any) => g.slug === urlData.groupSlug);
        if (group) {
          setSelectedGroupId(group.id);
        }
      } else if (urlData.type === "dm" && urlData.conversationId) {
        const conversation = conversationsData.find(
          (c: any) => c.id === urlData.conversationId
        );
        if (conversation) {
          setSelectedConversationId(conversation.id);
        }
      } else {
        // No URL data, restore from localStorage
        const stored = getStoredSelection();
        if (stored.groupId) {
          const groupExists = groupsData.some(
            (g: any) => g.id === stored.groupId
          );
          if (groupExists) {
            setSelectedGroupId(stored.groupId);
            // Restore channel if it exists
            if (stored.channelId) {
              // We'll verify channel exists after channels are loaded
              setSelectedChannelId(stored.channelId);
            }
          } else {
            // Group was deleted, clear stored selection
            setStoredSelection("SELECTED_GROUP", null);
            setStoredSelection("SELECTED_CHANNEL", null);
          }
        } else if (stored.conversationId) {
          const convExists = conversationsData.some(
            (c: any) => c.id === stored.conversationId
          );
          if (convExists) {
            setSelectedConversationId(stored.conversationId);
          } else {
            setStoredSelection("SELECTED_CONVERSATION", null);
          }
        }
      }

      setAppState("ready");
    } catch (error) {
      console.error("Failed to load profile data:", error);
      // Only change to auth state if we're not already ready
      if (appState !== "ready" && appState !== "loading") {
        setAppState("clerk-auth");
      }
    }
  }, [
    checkIdentityFn,
    setCurrentUser,
    setGroups,
    setChannels,
    setDMConversations,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
    channels,
    appState,
  ]);

  // Check for stored session on app start
  const checkStoredSession = useCallback(async () => {
    // Don't re-check if we're already ready or loading
    if (appState === "ready" || appState === "loading") {
      console.log("[App] Already initialized, skipping session check");
      return;
    }

    try {
      // First check if backend has already loaded a user (startup() may have loaded it)
      const user = await api.getCurrentUser();
      if (user) {
        // Backend already loaded the session and user
        console.log("[App] Backend already loaded user:", user.id);
        setCurrentUser(user);
        await loadProfileData();
        setAppState("ready");
        return;
      }

      // If no user loaded, check for stored session
      const session = await api.getStoredSession();
      console.log(
        "[App] Session check result:",
        session ? "found" : "not found"
      );

      if (session) {
        // Session exists but user not loaded yet, try to authenticate and load
        console.log("[App] Session found, authenticating...");
        setAppState("loading");
        try {
          // Initialize service URL before authentication (needed for user registration)
          const serviceURL =
            import.meta.env.VITE_SERVICE_URL || "localhost:50051";
          try {
            await api.setServiceURL(serviceURL);
            console.log("[App] Service URL initialized:", serviceURL);
          } catch (error) {
            console.warn(
              "[App] Failed to set service URL (service may be offline):",
              error
            );
            // Continue anyway - app can work offline
          }

          const authenticatedUser = await api.authenticateAndLoadUser(
            session.clerkToken
          );
          if (authenticatedUser) {
            setCurrentUser(authenticatedUser);
            await loadProfileData();
            setAppState("ready");
          } else {
            // Authentication failed, clear session and show auth
            console.warn("[App] Authentication failed, clearing session");
            await api.clearSession();
            setAppState("clerk-auth");
          }
        } catch (error) {
          console.error(
            "[App] Error authenticating with stored session:",
            error
          );
          // Don't clear session on error - might be temporary network issue
          // Only clear if it's an explicit auth failure
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes("failed to verify") ||
            errorMessage.includes("invalid token")
          ) {
            await api.clearSession();
            setAppState("clerk-auth");
          } else {
            // Temporary error - keep session and show ready state if user exists
            try {
              const user = await api.getCurrentUser();
              if (user) {
                setCurrentUser(user);
                await loadProfileData();
                setAppState("ready");
              } else {
                setAppState("clerk-auth");
              }
            } catch {
              // If getCurrentUser also fails, show auth screen
              setAppState("clerk-auth");
            }
          }
        }
      } else {
        // No session, show auth screen
        setAppState("clerk-auth");
      }
    } catch (error) {
      console.error("[App] Error checking session:", error);
      // Don't change state if we're already ready (might be a temporary error)
      // Use type assertion to bypass control flow narrowing
      if ((appState as AppState) !== "ready" && (appState as AppState) !== "loading") {
        setAppState("clerk-auth");
      }
    }
  }, [setCurrentUser, loadProfileData, appState]);

  // Track if we've already initialized to prevent infinite loops
  const hasInitializedRef = useRef(false);
  const isCheckingSessionRef = useRef(false);

  // Initialize app when ready
  useEffect(() => {
    // Wait for Wails to be ready
    if (!isWailsReady) return;

    // Only check once - never re-run even if Wails re-initializes
    if (hasInitializedRef.current) return;
    
    // Prevent concurrent session checks
    if (isCheckingSessionRef.current) return;
    
    hasInitializedRef.current = true;
    isCheckingSessionRef.current = true;

    checkStoredSession().finally(() => {
      isCheckingSessionRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWailsReady]); // checkStoredSession intentionally omitted to prevent loops

  // Listen for URL changes (popstate events)
  useEffect(() => {
    if (appState !== "ready") return;

    const handlePopState = () => {
      // URL changed, re-parse and update view
      const urlData = parseURL();
      if (urlData.type === "settings") {
        setSelectedGroupId(null);
        setSelectedChannelId(null);
        setSelectedConversationId(null);
      } else if (
        urlData.type === "channel" &&
        urlData.groupSlug &&
        urlData.channelSlug
      ) {
        // Find and select group/channel
        const group = groups.find((g) => g.slug === urlData.groupSlug);
        if (group) {
          setSelectedGroupId(group.id);
          const groupChannels = channels[group.id] || [];
          const channel = groupChannels.find(
            (c) => deriveSlug(c.name) === urlData.channelSlug
          );
          if (channel) {
            setSelectedChannelId(channel.id);
          }
        }
      } else if (urlData.type === "group" && urlData.groupSlug) {
        const group = groups.find((g) => g.slug === urlData.groupSlug);
        if (group) {
          setSelectedGroupId(group.id);
        }
      } else if (urlData.type === "dm" && urlData.conversationId) {
        const conversation = dmConversations.find(
          (c) => c.id === urlData.conversationId
        );
        if (conversation) {
          setSelectedConversationId(conversation.id);
        }
      } else if (urlData.type === null) {
        // Root path, clear selections
        setSelectedGroupId(null);
        setSelectedChannelId(null);
        setSelectedConversationId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    appState,
    groups,
    channels,
    dmConversations,
    setSelectedGroupId,
    setSelectedChannelId,
    setSelectedConversationId,
  ]);

  // Start authentication flow - opens browser for Clerk login
  // This should ONLY be called from the desktop app, never from browser
  const handleStartAuth = useCallback(async () => {
    // Double-check we're in desktop mode
    if (!isDesktop) {
      console.error(
        "handleStartAuth called from browser - this should not happen"
      );
      return;
    }

    setAppState("loading");
    setIsAuthenticating(true);

    try {
      // This opens the browser and waits for the callback
      const clerkToken = await api.authenticateWithClerk();

      // Authenticate and load/create user
      const user = await api.authenticateAndLoadUser(clerkToken);
      setCurrentUser(user);

      // Session is stored by backend automatically
      await loadProfileData();
      setAppState("ready");
    } catch (error) {
      setIsAuthenticating(false);
      const errorMessage = (error as Error).message;
      console.error("Authentication failed:", error);
      const errorMsg = errorMessage || String(error) || "Unknown error";
      if (!errorMsg.includes("cancelled")) {
        alert("Authentication failed: " + errorMsg);
      }
      setAppState("clerk-auth");
    } finally {
      setIsAuthenticating(false);
    }
  }, [setCurrentUser, loadProfileData, isDesktop]);

  // Cancel auth handler
  const handleCancelAuth = useCallback(async () => {
    try {
      await api.cancelAuth();
    } catch (error) {
      console.error("Failed to cancel auth:", error);
    }
    setIsAuthenticating(false);
    setAppState("clerk-auth");
  }, []);

  // Logout handler with confirmation dialog
  const handleLogout = useCallback(async () => {
    const deleteData = window.confirm(
      "Do you want to delete all local data?\n\n" +
        "Click OK to delete all data, or Cancel to keep data and just log out."
    );

    try {
      await api.logout(deleteData);
    } catch (error) {
      console.error("Failed to logout:", error);
    }

    // Clear stored selection
    setStoredSelection("SELECTED_GROUP", null);
    setStoredSelection("SELECTED_CHANNEL", null);
    setStoredSelection("SELECTED_CONVERSATION", null);

    setAppState("clerk-auth");
  }, []);

  // Poll network status every 5 seconds (only when ready)
  useEffect(() => {
    if (appState !== "ready") return;

    let mounted = true;
    const pollNetworkStatus = async () => {
      if (!mounted) return;
      try {
        const status = await api.getNetworkStatus();
        if (mounted) {
          setNetworkStatus(status);
        }
      } catch (error) {
        // Ignore errors during polling - don't log to avoid spam
        // Network status errors shouldn't cause app reload
      }
    };

    pollNetworkStatus();
    const interval = setInterval(pollNetworkStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [appState, setNetworkStatus]);

  // Show loading while initializing (wait for Wails on desktop, immediate on web)
  if (appState === "initializing" || (isDesktop && !isWailsReady)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const renderApp = () => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

    return (
      <div className="h-full w-full flex flex-col bg-black overflow-hidden">
        {isMac && isDesktop && (
          <div
            className="h-8 w-full absolute top-0 left-0 z-50 titlebar-drag"
            onDoubleClick={() => {
              const runtime = (window as any).runtime;
              if (runtime?.WindowToggleMaximise) {
                runtime.WindowToggleMaximise();
              }
            }}
          />
        )}
        {isDesktop && <TitleBar />}
        <div className={`flex-1 flex flex-col overflow-hidden ${isMac && isDesktop ? 'pt-8' : ''}`}>
        {appState === "loading" && (
          <div className="relative flex flex-col items-center justify-center min-h-full bg-black">
            <DotMatrix algorithm={pulsingWaveAlgorithm} />
            <Card
              className="relative z-10 text-center max-w-md bg-black/90"
              variant="bordered"
            >
              <LoadingSpinner size="lg" />
              {isAuthenticating && (
                <div className="mt-6">
                  <p className="text-orange-300/70 mb-4">
                    Complete sign-in in your browser...
                  </p>
                  <button
                    onClick={handleCancelAuth}
                    className="px-4 py-2 text-orange-300/70 hover:text-orange-300 border border-orange-300/30 hover:border-orange-300/50 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}

        {appState === "clerk-auth" && (
          <div className="relative flex flex-col items-center justify-center h-full bg-black">
            <DotMatrix algorithm={pulsingWaveAlgorithm} />
            <Card
              className="relative z-10 text-center max-w-md bg-black/90"
              // variant="bordered"
            >
              <h1 className="text-2xl font-bold text-orange-300 mb-4">
                Welcome to Pollis
              </h1>
              <p className="text-orange-300/70 mb-6">
                Sign in or create an account to continue
              </p>
              {isDesktop ? (
                <button
                  onClick={handleStartAuth}
                  className="px-6 py-3 bg-orange-300 text-black font-semibold rounded hover:bg-orange-200 transition-colors"
                >
                  Continue
                </button>
              ) : (
                <p className="text-orange-300/50 text-sm">
                  This app is desktop-only. Please use the desktop application.
                </p>
              )}
            </Card>
          </div>
        )}

        {appState === "ready" && currentUser && (
          <>
            {(() => {
              const urlData = parseURL();
              if (urlData.type === "settings") {
                return (
                  <div className="flex-1 flex overflow-hidden min-h-0">
                    <Sidebar
                      onCreateGroup={() => setShowCreateGroup(true)}
                      onCreateChannel={() => setShowCreateChannel(true)}
                      onSearchGroup={() => setShowSearchGroup(true)}
                      onStartDM={() => setShowStartDM(true)}
                      onLogout={handleLogout}
                      onOpenGroupIcon={(groupId) => {
                        setSelectedGroupForIcon(groupId);
                        setShowGroupIcon(true);
                      }}
                    />
                    <Settings />
                  </div>
                );
              }
              if (urlData.type === "group-settings") {
                return (
                  <div className="flex-1 flex overflow-hidden min-h-0">
                    <Sidebar
                      onCreateGroup={() => setShowCreateGroup(true)}
                      onCreateChannel={() => setShowCreateChannel(true)}
                      onSearchGroup={() => setShowSearchGroup(true)}
                      onStartDM={() => setShowStartDM(true)}
                      onLogout={handleLogout}
                      onOpenGroupIcon={(groupId) => {
                        setSelectedGroupForIcon(groupId);
                        setShowGroupIcon(true);
                      }}
                    />
                    <GroupSettings />
                  </div>
                );
              }
              return (
                <div className="flex-1 flex overflow-hidden min-h-0">
                  <Sidebar
                    onCreateGroup={() => setShowCreateGroup(true)}
                    onCreateChannel={() => setShowCreateChannel(true)}
                    onSearchGroup={() => setShowSearchGroup(true)}
                    onStartDM={() => setShowStartDM(true)}
                    onLogout={handleLogout}
                    onOpenGroupIcon={(groupId) => {
                      setSelectedGroupForIcon(groupId);
                      setShowGroupIcon(true);
                    }}
                  />
                  <MainContent />
                </div>
              );
            })()}

            <CreateGroupModal
              isOpen={showCreateGroup}
              onClose={() => setShowCreateGroup(false)}
            />
            <CreateChannelModal
              isOpen={showCreateChannel}
              onClose={() => setShowCreateChannel(false)}
            />
            <SearchGroupModal
              isOpen={showSearchGroup}
              onClose={() => setShowSearchGroup(false)}
            />
            <StartDMModal
              isOpen={showStartDM}
              onClose={() => setShowStartDM(false)}
            />
            <GroupIconModal
              isOpen={showGroupIcon}
              onClose={() => {
                setShowGroupIcon(false);
                setSelectedGroupForIcon(null);
              }}
              group={groups.find((g) => g.id === selectedGroupForIcon) || null}
              onIconUpdated={(iconUrl) => {
                // TODO: Update group in store with new icon URL
                console.log("Group icon updated:", iconUrl);
              }}
            />
          </>
        )}
      </div>
    </div>
    );
  };

  return renderApp();
}

export default App;
