import { auth } from "@clerk/nextjs/server";
import { headers } from 'next/headers';

// Use Edge Runtime for faster response times
export const runtime = 'edge';

// Disable caching for auth callback
export const dynamic = 'force-dynamic';

export default async function AuthCallback() {
  // Get token as fast as possible - auth() returns both userId and getToken
  const { userId, getToken } = await auth();

  if (!userId) {
    return (
      <html>
        <body style={{margin:0, display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#000', color:'#fdba74', fontFamily:'system-ui'}}>
          <div style={{textAlign:'center'}}>
            <h1>Authentication Error</h1>
            <p style={{color:'#f87171'}}>No active session found. Please sign in again.</p>
          </div>
        </body>
      </html>
    );
  }

  const token = await getToken();

  if (!token) {
    return (
      <html>
        <body style={{margin:0, display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#000', color:'#fdba74', fontFamily:'system-ui'}}>
          <div style={{textAlign:'center'}}>
            <h1>Authentication Error</h1>
            <p style={{color:'#f87171'}}>Failed to get authentication token</p>
          </div>
        </body>
      </html>
    );
  }

  // Minimal HTML - immediately redirect to desktop app
  // No external CSS, no framework overhead - just redirect
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body style={{margin:0, background:'#000'}}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function(){
              const s=new URLSearchParams(location.search).get('state'),
                    t=${JSON.stringify(token)},
                    u='http://127.0.0.1:44665/callback?'+(s?'state='+encodeURIComponent(s)+'&':'')+'token='+encodeURIComponent(t);
              location.replace(u);
            })();
          `,
          }}
        />
      </body>
    </html>
  );
}
