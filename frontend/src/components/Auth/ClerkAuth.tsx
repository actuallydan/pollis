import React, { useEffect, useRef } from 'react';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/clerk-react';
import { Card } from '../Card';
import { Header } from '../Header';
import { Paragraph } from '../Paragraph';

interface ClerkAuthProps {
  mode: 'signin' | 'signup';
  onSuccess: (clerkUserId: string, clerkToken: string, email: string, avatarUrl?: string) => void;
  onCancel: () => void;
}

export const ClerkAuth: React.FC<ClerkAuthProps> = ({ mode, onSuccess, onCancel }) => {
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const hasCalledSuccess = useRef(false);

  useEffect(() => {
    const handleAuthSuccess = async () => {
      // Wait for Clerk to fully load
      if (!isLoaded || !userLoaded) return;
      
      // Prevent calling onSuccess multiple times
      if (hasCalledSuccess.current) return;
      
      if (isSignedIn && user) {
        try {
          // Get the session token
          const token = await getToken();
          if (token) {
            hasCalledSuccess.current = true;
            const email = user.primaryEmailAddress?.emailAddress || '';
            const avatarUrl = user.imageUrl;
            onSuccess(user.id, token, email, avatarUrl);
          }
        } catch (error) {
          console.error('Failed to get Clerk token:', error);
        }
      }
    };

    handleAuthSuccess();
  }, [isSignedIn, user, getToken, onSuccess, isLoaded, userLoaded]);

  // Reset the ref when component unmounts or mode changes
  useEffect(() => {
    hasCalledSuccess.current = false;
  }, [mode]);

  const clerkAppearance = {
    elements: {
      rootBox: "w-full",
      card: "bg-transparent shadow-none border-0",
      headerTitle: "text-orange-300 text-xl font-bold",
      headerSubtitle: "text-orange-300/80 text-sm",
      socialButtonsBlockButton: "border-orange-300/40 text-orange-300 bg-orange-300/5 hover:bg-orange-300/15 hover:border-orange-300/60",
      socialButtonsBlockButtonText: "text-orange-300",
      socialButtonsBlockButtonArrow: "text-orange-300",
      formButtonPrimary: "bg-orange-300 text-black hover:bg-orange-200 font-semibold",
      formFieldInput: "bg-gray-900 border-orange-300/40 text-orange-100 focus:border-orange-300 focus:ring-2 focus:ring-orange-300/20",
      formFieldLabel: "text-orange-300/90 font-medium",
      formFieldErrorText: "text-red-400",
      footerActionLink: "text-orange-300 hover:text-orange-200 font-medium",
      identityPreviewText: "text-orange-300/90",
      identityPreviewEditButton: "text-orange-300 hover:text-orange-200",
      formResendCodeLink: "text-orange-300 hover:text-orange-200",
      otpCodeFieldInput: "bg-gray-900 border-orange-300/40 text-orange-100",
    },
    variables: {
      colorPrimary: "#f97316",
      colorText: "#fbbf24",
      colorTextSecondary: "#fbbf24",
      colorBackground: "#111111",
      colorInputBackground: "#1a1a1a",
      colorInputText: "#fbbf24",
      colorNeutral: "#fbbf24",
      borderRadius: "0.375rem",
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <Card className="w-full max-w-md" variant="bordered">
        <style>{`
          .clerk-auth-container {
            --clerk-primary: #f97316;
            --clerk-text: #fbbf24;
            --clerk-bg: #111111;
            --clerk-input-bg: #1a1a1a;
          }
          .clerk-auth-container * {
            color-scheme: dark;
          }
          .clerk-auth-container svg {
            filter: brightness(1.2);
          }
        `}</style>
        <Header size="lg" className="mb-2 text-center">
          {mode === 'signup' ? 'Create Profile' : 'Sign In'}
        </Header>
        <Paragraph size="sm" className="mb-6 text-center text-orange-300/70">
          {mode === 'signup'
            ? 'Sign up to create a new profile'
            : 'Sign in to access your profile'}
        </Paragraph>
        <div className="clerk-auth-container">
          {mode === 'signup' ? (
            <SignUp appearance={clerkAppearance} />
          ) : (
            <SignIn appearance={clerkAppearance} />
          )}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 text-orange-300/70 hover:text-orange-300 text-sm text-center w-full"
        >
          Cancel
        </button>
      </Card>
    </div>
  );
};
