import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAppStore } from "./stores/appStore";
import { TitleBar } from "./components/Layout/TitleBar";
import { EmailOTPAuth } from "./components/Auth/EmailOTPAuth";
import * as api from "./services/api";
import { useAblyRealtime } from "./hooks/useAblyRealtime";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes";
import type { User } from "./types";

type AppState = "initializing" | "loading" | "email-auth" | "ready";

function MainApp() {
  const {
    currentUser,
    setCurrentUser,
  } = useAppStore();

  const [appState, setAppState] = useState<AppState>("initializing");

  useAblyRealtime();
  useNetworkStatus(appState === "ready");

  const checkStoredSession = useCallback(async () => {
    try {
      const user = await api.getSession();
      if (user) {
        try {
          await api.initializeIdentity(user.id);
        } catch (err) {
          console.error("[App] Failed to initialize identity:", err);
        }
        setCurrentUser(user);
        setAppState("ready");
      } else {
        setAppState("email-auth");
      }
    } catch (error) {
      console.error("[App] Error checking session:", error);
      setAppState("email-auth");
    }
  }, [setCurrentUser]);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    checkStoredSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthSuccess = useCallback(async (user: User) => {
    try {
      await api.initializeIdentity(user.id);
    } catch (err) {
      console.error("[App] Failed to initialize identity:", err);
    }
    setCurrentUser(user);
    setAppState("ready");
  }, [setCurrentUser]);

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

    setAppState("email-auth");
  };

  if (appState === "initializing") {
    return (
      <div
        data-testid="loading-screen"
        className="flex items-center justify-center h-full w-full"
        style={{ background: 'var(--c-bg)' }}
      >
        <span
          data-testid="loading-spinner"
          className="text-xs font-mono"
          style={{ color: 'var(--c-text-muted)' }}
        >
          initializing…
        </span>
      </div>
    );
  }

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <div data-testid="app-root" style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {isMac && (
        <div
          style={{ height: "2rem", width: "100%", position: "absolute", top: 0, left: 0, zIndex: 50 }}
          className="titlebar-drag"
        />
      )}
      {/* <TitleBar /> */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {appState === "loading" && (
          <div
            data-testid="loading-screen"
            className="flex items-center justify-center h-full"
            style={{ background: 'var(--c-bg)' }}
          >
            <span
              data-testid="loading-spinner"
              className="text-xs font-mono"
              style={{ color: 'var(--c-text-muted)' }}
            >
              loading…
            </span>
          </div>
        )}

        {appState === "email-auth" && (
          <div
            data-testid="auth-screen"
            className="flex items-center justify-center h-full w-full"
            style={{ background: 'var(--c-bg)' }}
          >
            <div
              className="panel w-full max-w-sm p-8 flex flex-col gap-5"
            >
              <div>
                <h1 className="text-base font-mono font-bold" style={{ color: 'var(--c-accent)' }}>
                  Pollis.
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>
                  Sign in to continue
                </p>
              </div>
              <EmailOTPAuth onSuccess={handleAuthSuccess} />
            </div>
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
