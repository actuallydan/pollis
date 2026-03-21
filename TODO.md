# TODO

## Decisions needed
- **`app/` and `website-2/` directories**: Appear to be old prototypes. Delete if not needed.
- **Session tokens**: Currently using random UUID stored in keystore. Need to decide expiry policy (currently no expiry). Add refresh/expiry logic?

## Bugs
- [ ] DM unique constraint: users should only be able to create 1 DM with each other — needs a unique compound key that handles both orderings of `[userIdA, userIdB]`

## Doing
- [ ] First-time onboarding: show a loading screen / progress indicator during initial key generation and upload instead of a stalled verify screen
- [ ] Multi-device sign-out warning: show an explicit warning when signing in that doing so on a second device will break the first device's session until multi-device support is added

## Done (this sprint)
- [x] Unread indicators: badge counts `[N]` on channels and DMs in sidebar, clears on navigation
- [x] OS/system notifications: native notification fires when window is blurred and message arrives in non-active channel (tauri-plugin-notification)
- [x] Voice channels: VoiceBar, VoiceChannelView, useVoiceChannel hook, channel_type in Rust/DB, `[v]` prefix in sidebar — **requires Turso migration: `ALTER TABLE channels ADD COLUMN channel_type TEXT NOT NULL DEFAULT 'text';`**
- [x] Message search: SearchView, useSearchMessages hook, search_messages Rust command (LIKE on local SQLite message cache)
- [x] Account deletion: delete_account Rust command purges Turso + local DB + keystore; wired into Settings
- [x] Reply threads: fixed display of sender name + 80-char snippet in both MessageItem reply indicator and ReplyPreview banner
- [x] Emoji reactions: MessageReactions component, useReactions/useAddReaction/useRemoveReaction hooks, add_reaction/remove_reaction/get_reactions Rust commands — **requires Turso migration: create message_reaction table (see remote_schema.sql)**

## Immediate / in-progress
- [ ] `useViewCounter.ts` — remove this hook and all usages (not needed)

## Small effort
- [ ] Edit message: allow editing your own sent messages (update ciphertext in Turso, mark as edited, show edited indicator)
- [ ] Delete message: allow deleting your own sent messages (remove from Turso envelope + local cache, show deleted placeholder)
- [ ] Leave DM: let a user leave/archive a DM channel so it no longer appears in their sidebar
- [ ] Leave group: let a user leave a group they're a member of (remove from group_member, hide from sidebar)
- [ ] Remove user from group: let group admins kick a member — requires group admin roles first
- [ ] Group admin roles: designate group creator as admin; gate destructive actions (remove user) behind admin check
- [ ] Reactions: emoji reactions on messages stored in Turso (not E2EE — just reaction counts/who reacted)
- [ ] Inline image/file rendering: verify R2 download → inline display works end-to-end for received attachments
- [ ] CI: guard R2 upload step so it only runs if all 3 platform builds succeed
- [ ] Migration safety: add pre-flight schema check on startup, Turso PITR as backup before running migrations
- [ ] Nav bar: show lowest-level entity name after page — e.g. "Join Requests :: <Group Name>", "Direct Message :: @username", "Channel :: Memes with Friends"
- [ ] DM header: show the other user's username after "<- back Direct Message" and in the breadcrumb bottom-right

## Medium effort
- [ ] Add Playwright tests for auth flow, sidebar, messaging (testids are in place)
- [ ] E2E testing: Playwright for frontend + mocked Tauri commands for unit tests, real integration tests with test Turso DB
- [ ] Join group UX: when fetching groups by slug, join with the user's pending/rejected requests — hide "Request Access" if already requested, show rejection message with "try again?" if denied
- [ ] Join requests / find group: audit for component inconsistency, reuse cards and buttons throughout
- [ ] Error page: instead of crashing, redirect to an error page keyed by slug. Fetch and cache `error_slugs` table offline so the error page works without a DB connection
- [ ] Download management: decide versioning/rollback strategy before adding CDN downloads
- [ ] CI build optimization: parallelize macOS/Linux/Windows builds, share cargo cache
- [ ] Website speed: static export + reduce DotMatrix animation cost on Vercel

## Large effort
- [ ] Multi-device support: store one identity key per device in a `user_device` table instead of one per user; distribute sender keys to all devices; register/deregister devices on login/logout. Currently logging in on a second device overwrites the first device's identity key and breaks message delivery on both. **Back-burner until core MVP is stable.**
- [ ] OTA updates: fetch built frontend from R2, version check on startup, update flow with user notification (blocked by CDN downloads being set up first)

## Not doing yet
- Test that adding images to groups works and persists
- Wiki/onboarding docs (low priority while rebuilding)
