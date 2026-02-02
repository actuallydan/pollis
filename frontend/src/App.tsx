import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAppStore } from "./stores/appStore";
import { TitleBar } from "./components/Layout/TitleBar";
import { LoadingSpinner, DotMatrix, Card, pulsingWaveAlgorithm, gameOfLifeAlgorithm, mouseRippleAlgorithm, flowingWaveAlgorithm } from "monopollis";
import * as api from "./services/api";
import { useWailsReady } from "./hooks/useWailsReady";
import { useAblyRealtime } from "./hooks/useAblyRealtime";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import DesktopRequiredView from "./features/DesktopRequiredView";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes";

// Router handles URL-based state persistence

type AppState = "initializing" | "loading" | "clerk-auth" | "ready";


// Main app component (desktop only)
function MainApp() {
  const {
    currentUser,
    setCurrentUser,
    setUsername,
    setUserAvatarUrl,
    setGroups,
    setChannels,
    setDMConversations,
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
  const { isDesktop, isReady: isWailsReady } = useWailsReady();

  const dotMatrixAlgorithms =  [
    pulsingWaveAlgorithm,
    gameOfLifeAlgorithm,
    mouseRippleAlgorithm,
    flowingWaveAlgorithm,
  ]

  const randomIndex = Math.floor(Math.random() * dotMatrixAlgorithms.length);
  const dotMatrixAlgorithm = dotMatrixAlgorithms[randomIndex]

  // Ably real-time subscriptions (manages subscriptions based on selected channel)
  useAblyRealtime();

  // Network status monitoring (polls backend and listens to browser events)
  useNetworkStatus(appState === "ready");

  // Router handles URL-based state persistence

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

      // Note: User profile data (username, avatar) is now loaded via React Query
      // in the Sidebar component for network-first approach with automatic refetching

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

      // Router will handle URL-based navigation and route params
      // Just set app to ready state
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
    setUsername,
    setUserAvatarUrl,
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

  // Router handles URL changes automatically via RouterProvider

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
  const handleCancelAuth = async () => {
    try {
      await api.cancelAuth();
    } catch (error) {
      console.error("Failed to cancel auth:", error);
    }
    setIsAuthenticating(false);
    setAppState("clerk-auth");
  }

  // Logout handler with confirmation dialog
  const handleLogout = async () => {
    const deleteData = window.confirm(
      "Do you want to delete all local data?\n\n" +
      "Click OK to delete all data, or Cancel to keep data and just log out."
    );

    try {
      await api.logout(deleteData);
    } catch (error) {
      console.error("Failed to logout:", error);
    }

    // Router will handle navigation state
    setAppState("clerk-auth");
  }


  // Show loading while initializing (wait for Wails on desktop, immediate on web)
  if (appState === "initializing" || (isDesktop && !isWailsReady)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Desktop app only - browser auth is handled by desktop backend
  // The backend serves the OAuth callback pages on localhost:44665
  if (!isDesktop) {
    return (
      <DesktopRequiredView />
    );
  }

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <div className="h-full w-full flex flex-col bg-black overflow-hidden">
      {isMac && (
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
            <DotMatrix algorithm={dotMatrixAlgorithm} />
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
            <DotMatrix algorithm={dotMatrixAlgorithm} />
            <Card
              className="relative z-10 text-center max-w-md bg-black/90"
            // variant="bordered"
            >
              <h1 className="text-2xl font-bold text-orange-300 mb-4 font-mono">
                Welcome to Pollis
              </h1>
              <p className="text-orange-300/70 mb-6 font-mono">
                Sign in or create an account to continue
              </p>
              {isDesktop ? (
                <button
                  onClick={handleStartAuth}
                  className="px-6 py-3 bg-orange-300 text-black font-semibold rounded hover:bg-orange-200 transition-colors font-mono"
                >
                  Continue
                </button>
              ) : (
                <p className="text-orange-300/50 text-sm font-mono">
                  This app is desktop-only. Please use the desktop application.
                </p>
              )}
            </Card>
          </div>
        )}

        {appState === "ready" && currentUser && (
          <RouterProvider
            router={router}
            context={{ handleLogout }}
          />
        )}
      </div>
    </div>
  );
}

export default MainApp;
