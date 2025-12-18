import React, { useEffect, useState, useRef } from 'react';
import { useAuth, useClerk, SignIn, SignUp } from '@clerk/clerk-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Storage keys for persisting auth state across OAuth redirects
const DESKTOP_AUTH_STATE_KEY = 'pollis_desktop_auth_state';
const DESKTOP_AUTH_RETURN_URL_KEY = 'pollis_desktop_auth_return_url';

/**
 * Desktop Authentication Page
 * This page handles the desktop OAuth flow:
 * 1. Signs out any existing session
 * 2. Stores state/returnUrl in localStorage (survives OAuth redirects)
 * 3. Shows Clerk auth form
 * 4. After auth, reads state from localStorage and redirects to callback
 */
export const DesktopAuth: React.FC = () => {
  const { signOut } = useClerk();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(true);
  const [hasSignedOut, setHasSignedOut] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasRedirected = useRef(false);

  // Get URL params (fresh from desktop app) or from localStorage (after OAuth)
  const urlParams = new URLSearchParams(window.location.search);
  const urlState = urlParams.get('state');
  const urlReturnUrl = urlParams.get('return_url');
  
  // If we have fresh params, store them. Otherwise read from storage.
  const [state, setState] = useState<string>('');
  const [returnUrl, setReturnUrl] = useState<string>('http://127.0.0.1:44665/callback');

  // Initialize state from URL params or localStorage
  useEffect(() => {
    if (urlState) {
      // Fresh params from desktop app - store them
      localStorage.setItem(DESKTOP_AUTH_STATE_KEY, urlState);
      setState(urlState);
      console.log('[DesktopAuth] Stored state from URL:', urlState);
    } else {
      // No URL params - check localStorage (returning from OAuth)
      const stored = localStorage.getItem(DESKTOP_AUTH_STATE_KEY);
      if (stored) {
        setState(stored);
        console.log('[DesktopAuth] Loaded state from localStorage:', stored);
      }
    }

    if (urlReturnUrl) {
      localStorage.setItem(DESKTOP_AUTH_RETURN_URL_KEY, urlReturnUrl);
      setReturnUrl(urlReturnUrl);
    } else {
      const stored = localStorage.getItem(DESKTOP_AUTH_RETURN_URL_KEY);
      if (stored) {
        setReturnUrl(stored);
      }
    }
  }, [urlState, urlReturnUrl]);

  // Sign out any existing session (only if we have fresh URL params)
  useEffect(() => {
    const doSignOut = async () => {
      if (!isLoaded) return;
      
      // Only sign out if we have fresh params from desktop app
      // If no URL params, we're returning from OAuth and should NOT sign out
      if (urlState) {
        try {
          await signOut();
          console.log('[DesktopAuth] Signed out successfully');
        } catch (error) {
          console.log('[DesktopAuth] Sign out error (may already be signed out):', error);
        }
      }
      setIsSigningOut(false);
      setHasSignedOut(true);
    };

    if (isLoaded && !hasSignedOut) {
      doSignOut();
    }
  }, [isLoaded, signOut, hasSignedOut, urlState]);

  // After sign-in completes, get token and redirect to callback
  useEffect(() => {
    const handleAuthComplete = async () => {
      if (!isLoaded || isSigningOut || !hasSignedOut) return;
      if (!isSignedIn) return;
      if (hasRedirected.current || isRedirecting) return;
      if (!state) {
        console.error('[DesktopAuth] No state found - cannot complete auth');
        return;
      }

      console.log('[DesktopAuth] User signed in, getting token...');
      hasRedirected.current = true;
      setIsRedirecting(true);
      
      try {
        const token = await getToken();
        if (!token) {
          console.error('[DesktopAuth] Failed to get token');
          hasRedirected.current = false;
          setIsRedirecting(false);
          return;
        }

        // Clear stored auth state
        localStorage.removeItem(DESKTOP_AUTH_STATE_KEY);
        localStorage.removeItem(DESKTOP_AUTH_RETURN_URL_KEY);

        console.log('[DesktopAuth] Got token, redirecting to callback...');
        const callbackUrl = `${returnUrl}?state=${encodeURIComponent(state)}&__clerk_session_token=${encodeURIComponent(token)}`;
        console.log('[DesktopAuth] Callback URL:', callbackUrl.substring(0, 80) + '...');
        window.location.href = callbackUrl;
      } catch (error) {
        console.error('[DesktopAuth] Error getting token:', error);
        hasRedirected.current = false;
        setIsRedirecting(false);
      }
    };

    handleAuthComplete();
  }, [isLoaded, isSignedIn, isSigningOut, hasSignedOut, getToken, state, returnUrl, isRedirecting]);

  // Show loading while signing out or redirecting
  if (isSigningOut || !hasSignedOut || isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <LoadingSpinner size="lg" />
        <div className="mt-4 text-orange-300">
          {isRedirecting ? 'Completing authentication...' : 'Preparing sign-in...'}
        </div>
      </div>
    );
  }

  // Error state - no auth state available
  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="text-red-400 text-xl mb-4">Authentication Error</div>
        <div className="text-orange-300/70 mb-6">
          No authentication state found. Please try again from the desktop app.
        </div>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-orange-500 text-black rounded hover:bg-orange-400"
        >
          Close Window
        </button>
      </div>
    );
  }

  // Show sign-up form
  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-orange-300 text-center mb-6">
          Create New Profile
        </h1>
        <SignUp
          afterSignUpUrl={window.location.href}
          afterSignInUrl={window.location.href}
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-neutral-900 border border-orange-300/20",
              headerTitle: "text-orange-300",
              headerSubtitle: "text-orange-300/70",
              socialButtonsBlockButton: "border-orange-300/40 text-orange-300 bg-orange-300/5 hover:bg-orange-300/15",
              formButtonPrimary: "bg-orange-500 hover:bg-orange-400",
              formFieldInput: "bg-neutral-800 border-orange-300/40 text-orange-100",
              formFieldLabel: "text-orange-300/90",
              footerActionLink: "text-orange-300 hover:text-orange-200",
            },
            variables: {
              colorPrimary: "#f97316",
              colorText: "#fdba74",
              colorBackground: "#171717",
            }
          }}
        />
        <p className="text-center mt-4 text-orange-300/50 text-sm">
          Already have an account?{' '}
          <a 
            href={`/desktop-auth-signin?state=${encodeURIComponent(state)}&return_url=${encodeURIComponent(returnUrl)}`}
            className="text-orange-300 hover:text-orange-200"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
};

/**
 * Desktop Sign-In Page (alternative to sign-up)
 */
export const DesktopAuthSignIn: React.FC = () => {
  const { signOut } = useClerk();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(true);
  const [hasSignedOut, setHasSignedOut] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasRedirected = useRef(false);

  const urlParams = new URLSearchParams(window.location.search);
  const urlState = urlParams.get('state');
  const urlReturnUrl = urlParams.get('return_url');

  const [state, setState] = useState<string>('');
  const [returnUrl, setReturnUrl] = useState<string>('http://127.0.0.1:44665/callback');

  useEffect(() => {
    if (urlState) {
      localStorage.setItem(DESKTOP_AUTH_STATE_KEY, urlState);
      setState(urlState);
    } else {
      const stored = localStorage.getItem(DESKTOP_AUTH_STATE_KEY);
      if (stored) setState(stored);
    }

    if (urlReturnUrl) {
      localStorage.setItem(DESKTOP_AUTH_RETURN_URL_KEY, urlReturnUrl);
      setReturnUrl(urlReturnUrl);
    } else {
      const stored = localStorage.getItem(DESKTOP_AUTH_RETURN_URL_KEY);
      if (stored) setReturnUrl(stored);
    }
  }, [urlState, urlReturnUrl]);

  useEffect(() => {
    const doSignOut = async () => {
      if (!isLoaded) return;
      if (urlState) {
        try {
          await signOut();
        } catch (error) {
          // Ignore
        }
      }
      setIsSigningOut(false);
      setHasSignedOut(true);
    };

    if (isLoaded && !hasSignedOut) {
      doSignOut();
    }
  }, [isLoaded, signOut, hasSignedOut, urlState]);

  useEffect(() => {
    const handleAuthComplete = async () => {
      if (!isLoaded || isSigningOut || !hasSignedOut) return;
      if (!isSignedIn) return;
      if (hasRedirected.current || isRedirecting) return;
      if (!state) return;

      console.log('[DesktopAuthSignIn] User signed in, getting token...');
      hasRedirected.current = true;
      setIsRedirecting(true);

      try {
        const token = await getToken();
        if (token) {
          localStorage.removeItem(DESKTOP_AUTH_STATE_KEY);
          localStorage.removeItem(DESKTOP_AUTH_RETURN_URL_KEY);
          
          console.log('[DesktopAuthSignIn] Got token, redirecting...');
          const callbackUrl = `${returnUrl}?state=${encodeURIComponent(state)}&__clerk_session_token=${encodeURIComponent(token)}`;
          window.location.href = callbackUrl;
        } else {
          hasRedirected.current = false;
          setIsRedirecting(false);
        }
      } catch (error) {
        console.error('[DesktopAuthSignIn] Error:', error);
        hasRedirected.current = false;
        setIsRedirecting(false);
      }
    };

    handleAuthComplete();
  }, [isLoaded, isSignedIn, isSigningOut, hasSignedOut, getToken, state, returnUrl, isRedirecting]);

  if (isSigningOut || !hasSignedOut || isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <LoadingSpinner size="lg" />
        <div className="mt-4 text-orange-300">
          {isRedirecting ? 'Completing authentication...' : 'Preparing sign-in...'}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="text-red-400 text-xl mb-4">Authentication Error</div>
        <div className="text-orange-300/70 mb-6">
          No authentication state found. Please try again from the desktop app.
        </div>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-orange-500 text-black rounded hover:bg-orange-400"
        >
          Close Window
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-orange-300 text-center mb-6">
          Sign In
        </h1>
        <SignIn
          afterSignInUrl={window.location.href}
          afterSignUpUrl={window.location.href}
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-neutral-900 border border-orange-300/20",
              headerTitle: "text-orange-300",
              headerSubtitle: "text-orange-300/70",
              socialButtonsBlockButton: "border-orange-300/40 text-orange-300 bg-orange-300/5 hover:bg-orange-300/15",
              formButtonPrimary: "bg-orange-500 hover:bg-orange-400",
              formFieldInput: "bg-neutral-800 border-orange-300/40 text-orange-100",
              formFieldLabel: "text-orange-300/90",
              footerActionLink: "text-orange-300 hover:text-orange-200",
            },
            variables: {
              colorPrimary: "#f97316",
              colorText: "#fdba74",
              colorBackground: "#171717",
            }
          }}
        />
        <p className="text-center mt-4 text-orange-300/50 text-sm">
          Need an account?{' '}
          <a 
            href={`/desktop-auth?state=${encodeURIComponent(state)}&return_url=${encodeURIComponent(returnUrl)}`}
            className="text-orange-300 hover:text-orange-200"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};
