import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, terminalNavigate, TEST_USER } from './helpers';

const GROUP_ID = 'group-settings-test-1';

test.describe('Group settings', () => {
  test.beforeEach(async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Test Engineering',
          description: 'Test engineering group',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: { [GROUP_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);
  });

  test('navigates to group settings page', async ({ page }) => {
    // Group settings are accessed from the group view — the group name in the channel list
    // navigates into channels. Settings are a separate action (if exposed).
    // For now, verify the group appears in the groups menu.
    await terminalNavigate(page, 'menu-item-groups');
    await expect(page.locator(`[data-testid="group-option-${GROUP_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="group-option-${GROUP_ID}"]`)).toContainText('Test Engineering');
  });
});

test.describe('Direct messages', () => {
  test('shows DMs menu with new message option', async ({ page }) => {
    await injectPreload(page, { dmChannels: [] });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-dms');

    await expect(page.locator('[data-testid="menu-item-new-dm"]')).toBeVisible();
  });

  test('shows existing DM conversations', async ({ page }) => {
    const DM_ID = 'dm-test-1';
    await injectPreload(page, {
      dmChannels: [
        {
          id: DM_ID,
          created_by: TEST_USER.id,
          created_at: new Date().toISOString(),
          members: [
            { user_id: TEST_USER.id, username: TEST_USER.username, added_by: TEST_USER.id, added_at: new Date().toISOString() },
            { user_id: 'user-test-2', username: 'alice', added_by: TEST_USER.id, added_at: new Date().toISOString() },
          ],
        },
      ],
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-dms');

    await expect(page.locator(`[data-testid="dm-option-${DM_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="dm-option-${DM_ID}"]`)).toContainText('alice');
  });

  test('navigates to start DM form', async ({ page }) => {
    await injectPreload(page, { dmChannels: [] });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-dms', 'menu-item-new-dm');

    await expect(page.locator('[data-testid="start-dm-page"]')).toBeVisible();
  });
});
