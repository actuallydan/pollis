import React, { useState } from 'react';
import { Card } from '../Card';
import { Header } from '../Header';
import { Paragraph } from '../Paragraph';

interface ClerkAuthProps {
  mode: 'signin' | 'signup';
  onSuccess: (clerkUserId: string, clerkToken: string, email: string, avatarUrl?: string) => void;
  onCancel: () => void;
}

/**
 * ClerkAuth - Simplified authentication component
 *
 * Uses browser-based OAuth flow exclusively (no embedded Clerk UI)
 * Tokens are handled entirely by the Wails Go backend for security
 *
 * Per AUTH_AND_DB_MIGRATION.md:
 * - Frontend never handles raw Clerk tokens
 * - Backend owns loopback server and token storage
 * - CSRF protection via state parameter
 */
export const ClerkAuth: React.FC<ClerkAuthProps> = ({ mode, onSuccess, onCancel }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);

      // Check if we're in desktop (Wails) environment
      const isDesktop = typeof window !== 'undefined' && 'go' in window;

      if (isDesktop) {
        // Desktop: Trigger browser OAuth flow via Wails backend
        // @ts-ignore - Wails runtime
        const { AuthenticateWithClerk } = window.go.main.App;

        // This will open the system browser and handle the OAuth callback
        // The backend will emit an event when auth is complete
        await AuthenticateWithClerk();

        // Note: The actual onSuccess callback will be triggered by
        // a runtime event from the Go backend after successful auth
      } else {
        // Web: Not supported in this migration
        // In the future, could implement web-based auth flow
        setError('Web authentication not yet supported. Please use the desktop app.');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <Card className="w-full max-w-md" variant="bordered">
        <Header size="lg" className="mb-2 text-center">
          {mode === 'signup' ? 'Create Profile' : 'Sign In'}
        </Header>
        <Paragraph size="sm" className="mb-6 text-center text-orange-300/70">
          {mode === 'signup'
            ? 'Sign up to create a new profile'
            : 'Sign in to access your profile'}
        </Paragraph>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <Paragraph size="sm" className="text-red-400">{error}</Paragraph>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleAuth}
            disabled={isAuthenticating}
            className="w-full bg-orange-300 text-black hover:bg-orange-200 disabled:bg-orange-300/50 disabled:cursor-not-allowed font-semibold py-3 px-4 rounded transition-colors flex items-center justify-center"
          >
            {isAuthenticating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Opening browser...
              </span>
            ) : (
              mode === 'signup' ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Paragraph size="sm" className="text-orange-300/50">
            Authentication opens in your default browser
          </Paragraph>
          <Paragraph size="sm" className="text-orange-300/50 mt-1">
            After signing in, you can close the browser window
          </Paragraph>
        </div>

        <button
          onClick={onCancel}
          className="mt-4 text-orange-300/70 hover:text-orange-300 text-sm text-center w-full transition-colors"
        >
          Cancel
        </button>
      </Card>
    </div>
  );
};
