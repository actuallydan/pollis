import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, setStoreState, TEST_USER } from './helpers';

const GROUP_ID = 'group-test-1';
const CHANNEL_ID = 'channel-test-1';

test.describe('Send message', () => {
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
          {
            id: CHANNEL_ID,
            group_id: GROUP_ID,
            name: 'general',
          },
        ],
      },
      messages: { [CHANNEL_ID]: [] },
    });
    await page.goto('/');
    await waitForApp(page);
  });

  test('sends a message in a channel', async ({ page }) => {
    // Select the group and channel via Zustand store
    await setStoreState(page, {
      selectedGroupId: GROUP_ID,
      selectedChannelId: CHANNEL_ID,
    } as any);

    // Message input should be visible
    await page.waitForSelector('[data-testid="message-input"]');

    const messageText = 'Hello, world!';
    await page.fill('[data-testid="message-input"]', messageText);
    await page.click('[data-testid="message-send-button"]');

    // The message should appear in the message list after sending
    // (mock send_message adds to store, then list_messages refetches)
    await page.waitForSelector('[data-testid="message-content"]', { timeout: 5_000 });
    await expect(page.locator('[data-testid="message-content"]').first()).toContainText(messageText);
  });

  test('shows message input when channel is selected', async ({ page }) => {
    // Without a channel selected, should show empty state
    await expect(page.locator('[data-testid="empty-channel-message"]')).toBeVisible();

    // After selecting a channel, should show message input
    await setStoreState(page, {
      selectedGroupId: GROUP_ID,
      selectedChannelId: CHANNEL_ID,
    } as any);

    await page.waitForSelector('[data-testid="message-input"]');
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });

  test('sends message on Enter key', async ({ page }) => {
    await setStoreState(page, {
      selectedGroupId: GROUP_ID,
      selectedChannelId: CHANNEL_ID,
    } as any);

    await page.waitForSelector('[data-testid="message-input"]');
    await page.fill('[data-testid="message-input"]', 'Message via Enter');
    await page.keyboard.press('Enter');

    // Input should be cleared after sending
    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('');
  });
});
