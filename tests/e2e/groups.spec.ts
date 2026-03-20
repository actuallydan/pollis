import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, terminalNavigate, TEST_USER } from './helpers';

const GROUP_ID = 'group-test-1';
const CHANNEL_ID = 'channel-test-1';

test.describe('Groups list', () => {
  test('shows groups in the groups menu', async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Engineering',
          description: 'Engineering group',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: { [GROUP_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-groups');

    await expect(page.locator(`[data-testid="group-option-${GROUP_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="group-option-${GROUP_ID}"]`)).toContainText('Engineering');
  });

  test('shows empty groups list with create/find actions', async ({ page }) => {
    await injectPreload(page, { groups: [] });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-groups');

    await expect(page.locator('[data-testid="menu-item-create-group"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-item-find-group"]')).toBeVisible();
  });
});

test.describe('Group channels', () => {
  test('shows channels for a group', async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Engineering',
          description: 'Engineering group',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: {
        [GROUP_ID]: [
          { id: CHANNEL_ID, group_id: GROUP_ID, name: 'general' },
        ],
      },
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-groups', `group-option-${GROUP_ID}`);

    await expect(page.locator(`[data-testid="channel-option-${CHANNEL_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="channel-option-${CHANNEL_ID}"]`)).toContainText('general');
  });

  test('shows create channel option in group view', async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Engineering',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: { [GROUP_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-groups', `group-option-${GROUP_ID}`);

    await expect(page.locator('[data-testid="menu-item-create-channel"]')).toBeVisible();
  });
});

test.describe('Create group', () => {
  test.beforeEach(async ({ page }) => {
    await injectPreload(page, { groups: [] });
    await page.goto('/');
    await waitForApp(page);
  });

  test('navigates to create group form', async ({ page }) => {
    await terminalNavigate(page, 'menu-item-groups', 'menu-item-create-group');
    await expect(page.locator('[data-testid="create-group-page"]')).toBeVisible();
  });

  test('creates a group successfully', async ({ page }) => {
    await terminalNavigate(page, 'menu-item-groups', 'menu-item-create-group');
    await page.waitForSelector('[data-testid="create-group-page"]');

    await page.fill('[data-testid="create-group-name-input"]', 'My Team');
    await page.fill('[data-testid="create-group-description-input"]', 'Team workspace');
    await page.click('[data-testid="create-group-submit-button"]');

    // After creation, navigated away from create-group
    await expect(page.locator('[data-testid="create-group-page"]')).not.toBeVisible();
  });

  test('shows error for empty name', async ({ page }) => {
    await terminalNavigate(page, 'menu-item-groups', 'menu-item-create-group');
    await page.waitForSelector('[data-testid="create-group-page"]');

    await page.fill('[data-testid="create-group-name-input"]', '!!!');
    await page.evaluate(() => {
      const form = document.querySelector('[data-testid="create-group-form"]') as HTMLFormElement;
      if (form) { form.noValidate = true; }
    });
    await page.click('[data-testid="create-group-submit-button"]');

    await page.waitForSelector('[data-testid="create-group-error"]');
    await expect(page.locator('[data-testid="create-group-error"]')).toBeVisible();
  });
});

test.describe('Create channel', () => {
  test('navigates to create channel form from group view', async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Engineering',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: { [GROUP_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-groups', `group-option-${GROUP_ID}`, 'menu-item-create-channel');

    await expect(page.locator('[data-testid="create-channel-page"]')).toBeVisible();
  });

  test('creates a channel successfully', async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Engineering',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: { [GROUP_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(page, 'menu-item-groups', `group-option-${GROUP_ID}`, 'menu-item-create-channel');
    await page.waitForSelector('[data-testid="create-channel-page"]');

    await page.fill('[data-testid="create-channel-name-input"]', 'general');
    await page.click('[data-testid="create-channel-submit-button"]');

    await expect(page.locator('[data-testid="create-channel-page"]')).not.toBeVisible();
  });
});
