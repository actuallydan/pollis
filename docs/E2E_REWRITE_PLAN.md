# E2E Test Rewrite Plan

## Why a rewrite is needed

The existing tests were written for the old router-based layout (sidebar, TopBar, TanStack Router routes). The app has been replaced with a **terminal-menu stack navigation** (`TerminalApp`) that has no sidebar, no URL routing, and no persistent nav elements.

All sidebar `data-testid` selectors (`sidebar-create-group-button`, `user-settings-button`, etc.) and route-based navigation are now broken.

---

## New navigation model

All navigation is a `View[]` stack inside `TerminalApp`. User navigates by:
1. Selecting items in `TerminalMenu` (click or arrow keys + Enter)
2. Pressing Esc or clicking "← Go back" to pop the stack

The bottom status bar shows the breadcrumb path.

### Key `data-testid` anchors (as of the rewrite)

| Testid | Element |
|--------|---------|
| `terminal-app` | Root container (use instead of `app-root` in `waitForApp`) |
| `title-bar` | TitleBar |
| `title-bar-close/minimize/maximize` | Window controls |
| `auth-screen` | Auth page |
| `email-input` (hidden) | Email value for E2E assertions |
| `send-otp-button` | Continue button in email step |
| `otp-input` (hidden) | OTP value for assertions |
| `otp-form` | OTP form |
| `verify-otp-button` | Verify button |
| `message-input` | Textarea in chat |
| `message-send-button` | Send button |
| `message-list` | Message list container |
| `message-content` | Individual message text |
| `settings-page` | Settings page |
| `preferences-page` | Preferences page |
| `logout-confirm-screen` | Logout confirmation view |
| `logout-delete-data-button` | Delete data & sign out |
| `logout-keep-data-button` | Keep data & sign out |
| `logout-cancel-button` | Cancel logout |

---

## Helper changes needed

### `waitForApp` update
```typescript
// OLD
await page.waitForSelector('[data-testid="app-root"]', { timeout: 10_000 });

// NEW — terminal-app is the root when authenticated
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="terminal-app"]', { timeout: 10_000 });
}
```

### Navigation helper
Add a helper to navigate the terminal menu by label text:
```typescript
export async function terminalNavigate(page: Page, ...path: string[]): Promise<void> {
  for (const label of path) {
    await page.locator('[role="menuitem"]').filter({ hasText: label }).click();
  }
}
```

### Preload shape changes
The `messages` field in `Preload` uses wrong field names. Update:
```typescript
messages?: Record<string, Array<{
  id: string;
  channel_id?: string;
  conversation_id?: string;
  sender_id: string;
  content_decrypted?: string;
  created_at: number; // unix ms, NOT sent_at string
}>>;
```

---

## Test rewrites by file

### `groups.spec.ts`

**Old flow**: Click `sidebar-create-group-button` → form visible
**New flow**: Terminal menu → Groups → Create Group

```typescript
test('creates a group', async ({ page }) => {
  await injectPreload(page, { groups: [] });
  await page.goto('/');
  await waitForApp(page);

  // Navigate via terminal menu
  await terminalNavigate(page, 'Groups', 'Create Group');
  await page.waitForSelector('[data-testid="create-group-page"]');

  await page.fill('[data-testid="create-group-name-input"]', 'Engineering');
  await page.click('[data-testid="create-group-submit-button"]');

  // After create, the group should appear when navigating back to Groups
  await terminalNavigate(page, '← Go back', '← Go back', 'Groups');
  await expect(page.locator('[role="menuitem"]').filter({ hasText: 'Engineering' })).toBeVisible();
});
```

**Remove**: `create-channel` test (channel creation is now inside group menu, requires group to exist first — same logic but via terminal nav)

### `messages.spec.ts`

**Old flow**: `setStoreState` to inject selectedGroupId + selectedChannelId, then find inputs
**New flow**: Same `setStoreState` approach still works since MainContent reads from the store directly

Only change needed: `empty-channel-message` is still shown when no channel is selected inside TerminalApp's channel view. The test can remain mostly unchanged, but navigation to the channel view must go through the menu first OR inject the store state before the menu navigation.

```typescript
// Simplest approach: inject store state to bypass navigation
await setStoreState(page, {
  selectedGroupId: GROUP_ID,
  selectedChannelId: CHANNEL_ID,
} as any);
// Then navigate to channel view via menu so MainContent renders
await terminalNavigate(page, 'Groups', 'Engineering', '# general');
```

### `profile.spec.ts`

**Old flow**: Click `user-settings-button` → settings-page
**New flow**: Terminal menu → Settings

```typescript
test('navigates to settings', async ({ page }) => {
  await waitForApp(page);
  await terminalNavigate(page, 'Settings');
  await page.waitForSelector('[data-testid="settings-page"]');
});
```

**`settings-back-button`**: The back navigation is via the "← back" button in the page header. Update selector to the header back button or add `data-testid="settings-back-button"` to the `MenuPageHeader` back button in `TerminalApp.tsx`.

### `group-settings.spec.ts`

Needs full rewrite. Group settings page is accessible via: Groups → [group name] → (group settings button in some view). The group settings button needs a `data-testid` added.

---

## data-testid additions needed in source

Add these missing testids to make new tests reliable:

| Component | Element | Testid to add |
|-----------|---------|---------------|
| `TerminalApp.tsx` | MenuPageHeader back button for settings | `settings-back-button` |
| `TerminalApp.tsx` | MenuPageHeader back button for preferences | `preferences-back-button` |
| `TerminalApp.tsx` | MenuPageHeader back button for create-group | `create-group-back-button` |
| `TerminalApp.tsx` | The terminal menu container | Already has `role="menu"` |
| `App.tsx` | The ready state root wrapper | Add `data-testid="app-root"` to `TerminalApp`'s root div OR alias |

The cleanest fix is to add `data-testid="app-root"` alongside the existing `data-testid="terminal-app"` on the TerminalApp root div.

---

## Recommended test order

1. Fix `helpers.ts` (`waitForApp`, add `terminalNavigate`)
2. Add missing `data-testid` attributes to source
3. Rewrite `groups.spec.ts` for terminal navigation
4. Rewrite `messages.spec.ts` (minimal changes)
5. Rewrite `profile.spec.ts` for terminal navigation
6. Rewrite `group-settings.spec.ts` once group settings flow is clear
7. Add new: `auth.spec.ts` for email → OTP → login flow
8. Add new: `logout.spec.ts` for the logout confirm page
