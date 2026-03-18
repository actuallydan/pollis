import React, { useState } from 'react';

interface ClerkAuthProps {
  mode: 'signin' | 'signup';
  onSuccess: (clerkUserId: string, clerkToken: string, email: string, avatarUrl?: string) => void;
  onCancel: () => void;
}

export const ClerkAuth: React.FC<ClerkAuthProps> = ({ mode, onSuccess, onCancel }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);
      const isDesktop = typeof window !== 'undefined' && 'go' in window;
      if (isDesktop) {
        // @ts-ignore - Wails runtime
        const { AuthenticateWithClerk } = window.go.main.App;
        await AuthenticateWithClerk();
      } else {
        setError('Web authentication not yet supported. Please use the desktop app.');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticating(false);
    }
  };

  return (
    <div data-testid="clerk-auth">
      <h2>{mode === 'signup' ? 'Create Profile' : 'Sign In'}</h2>
      <p>
        {mode === 'signup'
          ? 'Sign up to create a new profile'
          : 'Sign in to access your profile'}
      </p>

      {error && (
        <p data-testid="clerk-auth-error">{error}</p>
      )}

      <button
        data-testid="clerk-auth-button"
        onClick={handleAuth}
        disabled={isAuthenticating}
      >
        {isAuthenticating ? 'Opening browser...' : (mode === 'signup' ? 'Sign Up' : 'Sign In')}
      </button>

      <p>Authentication opens in your default browser</p>
      <p>After signing in, you can close the browser window</p>

      <button
        data-testid="clerk-auth-cancel-button"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
};
