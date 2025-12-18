import React, { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

/**
 * Desktop OAuth Callback Page
 * This page is shown in the browser after Clerk authentication.
 * It gets the session token from Clerk and redirects back to the desktop app.
 */
export const DesktopCallback: React.FC = () => {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[DesktopCallback] isLoaded:', isLoaded, 'isSignedIn:', isSignedIn);
      
      if (!isLoaded) return;

      const urlParams = new URLSearchParams(window.location.search);
      const state = urlParams.get('state');
      const returnUrl = urlParams.get('return_url') || 'http://127.0.0.1:44665/callback';

      console.log('[DesktopCallback] state:', state, 'returnUrl:', returnUrl);

      if (!state) {
        console.error('[DesktopCallback] Missing state parameter');
        document.body.innerHTML = '<h1>Error: Missing state parameter</h1>';
        return;
      }

      if (!isSignedIn) {
        console.log('[DesktopCallback] Waiting for sign-in...');
        return;
      }

      try {
        // Get the session token (JWT)
        console.log('[DesktopCallback] Getting token...');
        const token = await getToken();
        console.log('[DesktopCallback] Token received:', token ? `${token.substring(0, 20)}...` : 'null');
        
        if (!token) {
          console.error('[DesktopCallback] Failed to get token');
          document.body.innerHTML = '<h1>Error: Failed to get session token</h1>';
          return;
        }

        // Redirect back to desktop app with token
        const callbackUrl = `${returnUrl}?state=${encodeURIComponent(state)}&__clerk_session_token=${encodeURIComponent(token)}`;
        console.log('[DesktopCallback] Redirecting to:', callbackUrl.substring(0, 100) + '...');
        window.location.href = callbackUrl;
      } catch (error) {
        console.error('[DesktopCallback] Failed to get token:', error);
        document.body.innerHTML = '<h1>Error: Failed to get session token</h1>';
      }
    };

    handleCallback();
  }, [isLoaded, isSignedIn, getToken]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <div className="mt-4 text-orange-300">
          Completing authentication...
        </div>
      </div>
    </div>
  );
};

