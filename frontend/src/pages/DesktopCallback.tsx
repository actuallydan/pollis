import React from 'react';

/**
 * Desktop OAuth Callback Page
 * This page is no longer needed with the new browser-based OAuth flow.
 * Clerk now redirects directly to the desktop app's callback server.
 */
export const DesktopCallback: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-orange-300/70 text-center">
        <p className="mb-4">This page is deprecated.</p>
        <p>Authentication is now handled directly by the desktop app.</p>
      </div>
    </div>
  );
};

