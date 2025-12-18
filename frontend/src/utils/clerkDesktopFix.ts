// Workaround for Clerk dev browser authentication in desktop apps
// The issue: Clerk dev instances require a "dev browser" cookie that's set when you visit
// Clerk in a regular browser. Desktop app webviews don't have this cookie.
//
// REAL SOLUTION: Use a production Clerk instance (pk_live_...) instead of dev (pk_test_...)
// Production instances don't require the dev browser cookie.
//
// This file provides helpful error messages and potential workarounds

export const setupClerkDesktopFix = () => {
  // Monitor for the specific error and provide helpful feedback
  const originalFetch = window.fetch;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // If it's a Clerk API request
    if (url.includes('clerk.accounts.dev') || url.includes('clerk.com')) {
      try {
        const response = await originalFetch(input, {
          ...init,
          credentials: 'include' as RequestCredentials,
        });
        
        // Check for dev browser error
        if (response.status === 401) {
          const clonedResponse = response.clone();
          try {
            const data = await clonedResponse.json();
            if (data.errors?.[0]?.code === 'dev_browser_unauthenticated') {
              console.error('❌ Clerk Dev Browser Authentication Error');
              console.error('Your Clerk key starts with pk_test_ (development instance)');
              console.error('Development instances require a "dev browser" cookie that desktop apps don\'t have.');
              console.error('');
              console.error('✅ SOLUTION: Switch to a PRODUCTION Clerk instance:');
              console.error('1. Go to Clerk Dashboard → Your App → Settings');
              console.error('2. Create or switch to a PRODUCTION instance');
              console.error('3. Copy the production publishable key (starts with pk_live_...)');
              console.error('4. Update VITE_CLERK_PUBLISHABLE_KEY in .env.local');
              console.error('5. Restart your app');
            }
          } catch {
            // Not JSON, ignore
          }
        }
        
        return response;
      } catch (error) {
        console.error('Clerk API request failed:', error);
        throw error;
      }
    }
    
    return originalFetch(input, init);
  };
};

