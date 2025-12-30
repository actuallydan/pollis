import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Use Edge Runtime for faster response times
export const runtime = 'edge';

export default async function AuthCallback() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-amber-400 mb-6">
            Authentication Error
          </h1>
          <p className="text-lg text-red-400">
            No active session found. Please sign in again.
          </p>
        </div>
      </div>
    );
  }

  const token = await getToken();

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-amber-400 mb-6">
            Authentication Error
          </h1>
          <p className="text-lg text-red-400">
            Failed to get authentication token
          </p>
        </div>
      </div>
    );
  }

  // Redirect to desktop app on localhost
  // Note: This is a server component, so we need to use a client-side redirect
  // to preserve URL parameters (like state) from the original request
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-amber-400 mb-6">
          Completing Authentication...
        </h1>
        <p className="text-lg text-gray-300">
          Redirecting to desktop app...
        </p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Get state from URL if present
            const urlParams = new URLSearchParams(window.location.search);
            const state = urlParams.get('state');
            const token = ${JSON.stringify(token)};

            // Build callback URL with state and token
            let callbackURL = 'http://127.0.0.1:44665/callback?';
            if (state) {
              callbackURL += 'state=' + encodeURIComponent(state) + '&';
            }
            callbackURL += 'token=' + encodeURIComponent(token);

            // Redirect
            window.location.href = callbackURL;
          `,
        }}
      />
    </div>
  );
}
