# Pollis Website

Next.js website for pollis.com

## Deploy to Vercel

1. Connect GitHub repo to Vercel
2. Set **Root Directory** to: `website`
3. Add environment variable:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_Y2xlcmsucG9sbGlzLmNvbSQ`
4. Deploy

Vercel auto-detects pnpm from the lockfile and builds the monorepo correctly.

## After Deployment

Update Clerk Dashboard:
- **Configure** → **Account Portal** → **Redirects**
- Set **"After sign-in fallback"** to: `https://pollis.com/auth-callback`

## Local Dev

```bash
pnpm dev
```

## Routes

- `/` - Landing page with DotMatrix animation
- `/auth-callback` - OAuth callback for desktop app
