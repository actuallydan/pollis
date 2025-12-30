import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect when Wails runtime is ready
 * Returns { isDesktop, isReady }
 * - isDesktop: true if running in Wails desktop app
 * - isReady: true when we've determined the environment (either Wails is ready or we're in web)
 *
 * Per Wails docs: The runtime scripts (/wails/ipc.js and /wails/runtime.js) are automatically
 * injected and populate window.go and window.runtime. We poll for their availability.
 */
export function useWailsReady() {
  const [isReady, setIsReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const hasResolved = useRef(false);

  useEffect(() => {
    if (hasResolved.current) return;

    // Check if Wails runtime scripts have loaded and populated the runtime
    const checkWailsRuntime = () => {
      const win = window as any;

      // Full runtime check: both bindings and all required methods must be available
      const hasFullRuntime =
        typeof win.go !== 'undefined' &&
        typeof win.go.main !== 'undefined' &&
        typeof win.go.main.App !== 'undefined' &&
        typeof win.runtime !== 'undefined' &&
        typeof win.runtime.EventsOnMultiple !== 'undefined';

      return hasFullRuntime;
    };

    // Production: wails:// protocol
    const isWailsProtocol = window.location.protocol === 'wails:';

    // Development: check if we're on localhost (Wails dev server)
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

    // If we're definitely NOT in Wails (web browser), resolve immediately
    if (!isWailsProtocol && !isLocalhost) {
      hasResolved.current = true;
      setIsDesktop(false);
      setIsReady(true);
      return;
    }

    // Check immediately if runtime is already available
    if (checkWailsRuntime()) {
      hasResolved.current = true;
      setIsDesktop(true);
      setIsReady(true);
      return;
    }

    // Poll for runtime availability (Wails injects scripts asynchronously)
    // Per docs: scripts are injected into <body>, may take a moment to execute
    let pollCount = 0;
    const maxPolls = 50; // 5 seconds max (100ms * 50)

    const pollInterval = setInterval(() => {
      pollCount++;

      if (checkWailsRuntime()) {
        // Runtime is ready
        clearInterval(pollInterval);
        if (!hasResolved.current) {
          hasResolved.current = true;
          setIsDesktop(true);
          setIsReady(true);
        }
      } else if (pollCount >= maxPolls) {
        // Timeout: assume we're in web browser or runtime failed to load
        clearInterval(pollInterval);
        if (!hasResolved.current) {
          hasResolved.current = true;
          setIsDesktop(false);
          setIsReady(true);
        }
      }
    }, 100);

    return () => clearInterval(pollInterval);
  }, []);

  return { isDesktop, isReady };
}

/**
 * Synchronous check for desktop (use sparingly, prefer the hook)
 */
export function checkIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'wails:' || typeof (window as any).go !== 'undefined';
}
