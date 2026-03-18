# TODO

## Decisions needed
- **Email provider for OTP auth**: Currently wired to Resend (POST to api.resend.com). Add `RESEND_API_KEY` to your `.env.development`. Alternatives: SendGrid, Mailgun, SMTP. Easy swap in `src-tauri/src/commands/auth.rs`.
- **`app/` and `website-2/` directories**: Appear to be old prototypes. Delete if not needed.
- **Session tokens**: Currently using random UUID stored in keystore. Need to decide expiry policy (currently no expiry). Add refresh/expiry logic?
- **Username setup**: After OTP auth, user gets email as default username. Need a "set username" step on first login?

## Bugs
- [ ] R2 avatar upload: 403 SignatureDoesNotMatch — canonical request shows `content-type:image/jpeg, image/jpeg` (duplicated), likely caused by reqwest setting Content-Type on top of our SigV4 header. Possibly also a CORS/bucket policy issue. Fix: don't set Content-Type separately in the reqwest call since sigv4_headers already includes it.

## Immediate / in-progress
- [ ] Add Playwright tests for auth flow, sidebar, messaging (testids are in place)
- [ ] Wire up Resend API key in config (add to `src-tauri/src/config.rs` and `.env.example`)
- [ ] Verify OTP auth works end-to-end (request + verify commands added to Tauri)
- [ ] Add styles pass — UI is intentionally unstyled right now, bring in monopollis-ui components selectively
- [ ] `useViewCounter.ts` — remove this hook and all usages (not needed)
- [ ] Remove Clerk dependency from `frontend/package.json` once auth is confirmed working

## Small effort
- [ ] CI: guard R2 upload step so it only runs if all 3 platform builds succeed (verify release job dependency is correct)
- [ ] Multiple dev clients for local testing: separate SQLite profiles (different `TAURI_APP_DATA_DIR` or separate Tauri dev instances)
- [ ] Migration safety: add pre-flight schema check on startup, Turso PITR as backup before running migrations
- [ ] Website speed: static export + reduce DotMatrix animation cost on Vercel

## Medium effort
- [ ] E2E testing plan: Playwright for frontend + mocked Tauri commands for unit tests, real integration tests with test Turso DB
- [ ] Download management: decide versioning/rollback strategy before adding CDN downloads
- [ ] CI build optimization: parallelize macOS/Linux/Windows builds, share cargo cache

## Large effort
- [ ] OTA updates: fetch built frontend from R2, version check on startup, update flow with user notification (blocked by CDN downloads being set up first)

## Not doing yet
- Manage secrets better between dev and prod
- Test that adding images to groups works and persists
- Wiki/onboarding docs (low priority while rebuilding)
- Docker/server logging solutions (server removed, no longer relevant)
