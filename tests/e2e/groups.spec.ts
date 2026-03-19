import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, TEST_USER } from './helpers';

test.describe('Create group', () => {
  test.beforeEach(async ({ page }) => {
    await injectPreload(page, { groups: [] });
    await page.goto('/');
    await waitForApp(page);
  });

  test('creates a group and shows it in the sidebar', async ({ page }) => {
    // Navigate to create group page via sidebar button
    await page.click('[data-testid="sidebar-create-group-button"]');
    await page.waitForSelector('[data-testid="create-group-page"]');

    // Fill in group details
    await page.fill('[data-testid="create-group-name-input"]', 'Engineering');
    await page.fill('[data-testid="create-group-description-input"]', 'Engineering team workspace');

    // Slug should auto-populate
    const slugValue = await page.inputValue('[data-testid="create-group-slug-input"]');
    expect(slugValue).toBe('engineering');

    // Submit
    await page.click('[data-testid="create-group-submit-button"]');

    // Should navigate away from create-group page and show the new group in sidebar
    await page.waitForSelector('[data-testid^="group-item-"]');
    const groupItem = page.locator('[data-testid^="group-item-"]');
    await expect(groupItem).toBeVisible();
  });

  test('shows validation error for invalid name', async ({ page }) => {
    await page.click('[data-testid="sidebar-create-group-button"]');
    await page.waitForSelector('[data-testid="create-group-page"]');

    // A name with only special characters produces an empty slug,
    // which triggers React-level validation without relying on browser required-field popup
    await page.fill('[data-testid="create-group-name-input"]', '!!!');
    // Disable browser native validation so React handleSubmit runs
    await page.evaluate(() => {
      const form = document.querySelector('[data-testid="create-group-form"]') as HTMLFormElement;
      if (form) {
        form.noValidate = true;
      }
    });
    await page.click('[data-testid="create-group-submit-button"]');

    await page.waitForSelector('[data-testid="create-group-error"]');
    await expect(page.locator('[data-testid="create-group-error"]')).toBeVisible();
  });
});

test.describe('Create channel', () => {
  test('creates a channel after first creating a group', async ({ page }) => {
    await injectPreload(page, { groups: [] });
    await page.goto('/');
    await waitForApp(page);

    // Create a group first
    await page.click('[data-testid="sidebar-create-group-button"]');
    await page.waitForSelector('[data-testid="create-group-page"]');
    await page.fill('[data-testid="create-group-name-input"]', 'My Team');
    await page.click('[data-testid="create-group-submit-button"]');

    // Wait for group to appear in sidebar and be selected
    await page.waitForSelector('[data-testid^="group-item-"]');

    // Click the create channel button (visible when group is selected)
    await page.click('[data-testid="create-channel-button"]');
    await page.waitForSelector('[data-testid="create-channel-page"]');

    // Fill in channel details
    await page.fill('[data-testid="create-channel-name-input"]', 'general');

    // Slug should auto-populate
    const slugValue = await page.inputValue('[data-testid="create-channel-slug-input"]');
    expect(slugValue).toBe('general');

    // Submit
    await page.click('[data-testid="create-channel-submit-button"]');

    // Should navigate away from create-channel page and show the new channel
    await page.waitForSelector('[data-testid^="channel-item-"]');
    const channelItem = page.locator('[data-testid^="channel-item-"]');
    await expect(channelItem).toBeVisible();
  });
});
