# TODO

## Decisions needed
- **`app/` and `website-2/` directories**: Appear to be old prototypes. Delete if not needed.
- **Session tokens**: Currently using random UUID stored in keystore. Need to decide expiry policy (currently no expiry). Add refresh/expiry logic?

## Bugs
- [ ] DM unique constraint: users should only be able to create 1 DM with each other — needs a unique compound key that handles both orderings of `[userIdA, userIdB]`

## Immediate / in-progress
- [ ] Add Playwright tests for auth flow, sidebar, messaging (testids are in place)
- [ ] Verify OTP auth works end-to-end (request + verify commands added to Tauri)
- [ ] `useViewCounter.ts` — remove this hook and all usages (not needed)
- [ ] Remove Clerk dependency from `frontend/package.json` once auth is confirmed working

## Small effort
- [ ] CI: guard R2 upload step so it only runs if all 3 platform builds succeed
- [ ] Migration safety: add pre-flight schema check on startup, Turso PITR as backup before running migrations
- [ ] Website speed: static export + reduce DotMatrix animation cost on Vercel
- [ ] Nav bar: show lowest-level entity name after page — e.g. "Join Requests :: <Group Name>", "Direct Message :: @username", "Channel :: Memes with Friends"
- [ ] DM header: show the other user's username after "<- back Direct Message" and in the breadcrumb bottom-right
- [ ] Chat input: placeholder color should be brighter when unfocused, darker when focused
- [ ] Refresh command: Cmd/Ctrl+R should invalidate React Query cache and refetch (not hard reload). Show "Syncing…" indicator in nav pane while in flight
- [ ] Unread indicators: show unread message count on channels and DMs in the sidebar

## Medium effort
- [ ] E2E testing: Playwright for frontend + mocked Tauri commands for unit tests, real integration tests with test Turso DB
- [ ] Download management: decide versioning/rollback strategy before adding CDN downloads
- [ ] CI build optimization: parallelize macOS/Linux/Windows builds, share cargo cache
- [ ] Join group UX: when fetching groups by slug, join with the user's pending/rejected requests — hide "Request Access" if already requested, show rejection message with "try again?" if denied
- [ ] Join requests / find group: audit for component inconsistency, reuse cards and buttons throughout
- [ ] Error page: instead of crashing, redirect to an error page keyed by slug. Fetch and cache `error_slugs` table `(id, error_slug, error_text, error_description?, redirect_url?)` offline so the error page works without a DB connection
- [ ] Calls (mock): under New Message in DMs, add a "Start a call" option — mock UI showing pretend online users with a call indicator, no real functionality yet

## Large effort
- [ ] Multi-device support: store one identity key per device in a `user_device` table instead of one per user; distribute sender keys to all devices; register/deregister devices on login/logout. Currently logging in on a second device overwrites the first device's identity key and breaks message delivery on both.
- [ ] OTA updates: fetch built frontend from R2, version check on startup, update flow with user notification (blocked by CDN downloads being set up first)

## Not doing yet
- Test that adding images to groups works and persists
- Wiki/onboarding docs (low priority while rebuilding)
##  Unsorted
- [ ] when a user signs in for the first time it's prohibitvely slow to transition, we should either take them to a loading screen, display some loader to replace the verify that indicates it's doing first time setup or make it faster somehow
