import type { Page } from '@playwright/test';

export const TEST_USER = {
  id: 'user-test-1',
  email: 'test@example.com',
  username: 'testuser',
};

export const TEST_USER_2 = {
  id: 'user-test-2',
  email: 'test2@example.com',
  username: 'testuser2',
};

export interface Preload {
  session?: typeof TEST_USER | null;
  profile?: { id: string; username?: string; phone?: string };
  groups?: Array<{ id: string; name: string; description?: string; owner_id: string; created_at: string }>;
  channels?: Record<string, Array<{ id: string; group_id: string; name: string; description?: string }>>;
  messages?: Record<string, Array<{ id: string; conversation_id: string; sender_id: string; content?: string; sent_at: string }>>;
  dmChannels?: Array<{ id: string; created_by: string; created_at: string; members: Array<{ user_id: string; username?: string; added_by: string; added_at: string }> }>;
}

/**
 * Set window.__POLLIS_PRELOAD__ before React hydrates.
 * Call this before page.goto().
 */
export async function injectPreload(page: Page, overrides: Partial<Preload> = {}): Promise<void> {
  const data: Preload = {
    session: TEST_USER,
    profile: { id: TEST_USER.id, username: TEST_USER.username, phone: '' },
    groups: [],
    channels: {},
    messages: {},
    dmChannels: [],
    ...overrides,
  };
  await page.addInitScript((d) => {
    (window as any).__POLLIS_PRELOAD__ = d;
  }, data);
}

/**
 * Wait for the app to reach the authenticated "ready" state.
 */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="terminal-app"]', { timeout: 10_000 });
}

/**
 * Navigate through the terminal menu by clicking items with the given testIds in order.
 */
export async function terminalNavigate(page: Page, ...testIds: string[]): Promise<void> {
  for (const testId of testIds) {
    await page.locator(`[data-testid="${testId}"]`).click();
  }
}

/**
 * Set Zustand store state directly via window.__pollisStore.
 * Only available when VITE_PLAYWRIGHT=true.
 */
export async function setStoreState(page: Page, state: Record<string, unknown>): Promise<void> {
  await page.waitForFunction(() => !!(window as any).__pollisStore, { timeout: 5_000 });
  await page.evaluate((s) => {
    (window as any).__pollisStore.setState(s);
  }, state);
}
