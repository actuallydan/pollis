import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, terminalNavigate, TEST_USER } from './helpers';

const GROUP_ID = 'group-test-1';
const CHANNEL_ID = 'channel-test-1';

test.describe('Channel messaging', () => {
  test.beforeEach(async ({ page }) => {
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
      messages: { [CHANNEL_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);

    // Navigate into the channel
    await terminalNavigate(
      page,
      'menu-item-groups',
      `group-option-${GROUP_ID}`,
      `channel-option-${CHANNEL_ID}`,
    );

    await page.waitForSelector('[data-testid="message-input"]');
  });

  test('shows message input when channel is open', async ({ page }) => {
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });

  test('sends a message via button click', async ({ page }) => {
    const messageText = 'Hello, world!';
    await page.fill('[data-testid="message-input"]', messageText);
    await page.click('[data-testid="message-send-button"]');

    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('');
    await page.waitForSelector('[data-testid="message-content"]', { timeout: 5_000 });
    await expect(page.locator('[data-testid="message-content"]').first()).toContainText(messageText);
  });

  test('sends a message via Enter key', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Message via Enter');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('');
  });
});

test.describe('Channel navigation', () => {
  test('shows channel view when navigating into a channel', async ({ page }) => {
    await injectPreload(page, {
      groups: [
        {
          id: GROUP_ID,
          name: 'Engineering',
          owner_id: TEST_USER.id,
          created_at: new Date().toISOString(),
        },
      ],
      channels: {
        [GROUP_ID]: [
          { id: CHANNEL_ID, group_id: GROUP_ID, name: 'general' },
          { id: 'channel-test-2', group_id: GROUP_ID, name: 'random' },
        ],
      },
      messages: {},
    });
    await page.goto('/');
    await waitForApp(page);

    await terminalNavigate(
      page,
      'menu-item-groups',
      `group-option-${GROUP_ID}`,
      `channel-option-${CHANNEL_ID}`,
    );

    // Channel view should show the message input
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });
});
