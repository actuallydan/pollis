import React from 'react';

/**
 * Desktop Authentication Page
 * This page is no longer needed with the new browser-based OAuth flow.
 * The desktop app now handles authentication directly via AuthenticateWithClerk()
 * which opens the system browser to Clerk's OAuth page.
 */
export const DesktopAuth: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="text-orange-300/70 text-center">
        <p className="mb-4">This page is deprecated.</p>
        <p>Please use the desktop app's authentication flow.</p>
      </div>
    </div>
  );
};

/**
 * Desktop Sign-In Page
 * This page is no longer needed with the new browser-based OAuth flow.
 */
export const DesktopAuthSignIn: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="text-orange-300/70 text-center">
        <p className="mb-4">This page is deprecated.</p>
        <p>Please use the desktop app's authentication flow.</p>
      </div>
    </div>
  );
};
