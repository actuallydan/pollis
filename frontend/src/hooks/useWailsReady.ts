import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect when Wails runtime is ready
 * Returns { isDesktop, isReady }
 * - isDesktop: true if running in Wails desktop app
 * - isReady: true when we've determined the environment (either Wails is ready or we're in web)
 */
export function useWailsReady() {
  const [isReady, setIsReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const hasResolved = useRef(false);

  useEffect(() => {
    if (hasResolved.current) return;

    // Check if already running in Wails (production build)
    if (window.location.protocol === 'wails:') {
      hasResolved.current = true;
      setIsDesktop(true);
      setIsReady(true);
      return;
    }

    // In development, Wails runtime is injected as window.go
    // It might take a moment to be available
    const checkWails = () => {
      if (typeof (window as any).go !== 'undefined') {
        if (!hasResolved.current) {
          hasResolved.current = true;
          setIsDesktop(true);
          setIsReady(true);
        }
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkWails()) return;

    // Poll for Wails runtime (it's injected after page load in dev)
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max
    const interval = setInterval(() => {
      attempts++;
      if (checkWails()) {
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        if (!hasResolved.current) {
          // After timeout, assume we're in web browser
          hasResolved.current = true;
          setIsDesktop(false);
          setIsReady(true);
        }
      }
    }, 100);

    return () => clearInterval(interval);
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
