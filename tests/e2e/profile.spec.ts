import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, TEST_USER } from './helpers';

test.describe('Edit user profile', () => {
  test.beforeEach(async ({ page }) => {
    await injectPreload(page, {
      profile: { id: TEST_USER.id, username: 'originalname', phone: '555-0100' },
    });
    await page.goto('/');
    await waitForApp(page);
  });

  test('navigates to settings page', async ({ page }) => {
    await page.click('[data-testid="user-settings-button"]');
    await page.waitForSelector('[data-testid="settings-page"]');
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();
  });

  test('loads existing profile data', async ({ page }) => {
    await page.click('[data-testid="user-settings-button"]');
    await page.waitForSelector('[data-testid="settings-page"]');

    // Wait for profile data to load (React Query fetch)
    await page.waitForFunction(() => {
      const input = document.querySelector('[data-testid="settings-username-input"]') as HTMLInputElement;
      return input && input.value !== '';
    }, { timeout: 5_000 });

    const usernameValue = await page.inputValue('[data-testid="settings-username-input"]');
    expect(usernameValue).toBe('originalname');

    const phoneValue = await page.inputValue('[data-testid="settings-phone-input"]');
    expect(phoneValue).toBe('555-0100');
  });

  test('saves updated username', async ({ page }) => {
    await page.click('[data-testid="user-settings-button"]');
    await page.waitForSelector('[data-testid="settings-page"]');

    // Wait for input to have a value before clearing
    await page.waitForFunction(() => {
      const input = document.querySelector('[data-testid="settings-username-input"]') as HTMLInputElement;
      return input && input.value !== '';
    }, { timeout: 5_000 });

    await page.fill('[data-testid="settings-username-input"]', 'newusername');
    await page.click('[data-testid="settings-save-button"]');

    // Success message should appear
    await page.waitForSelector('[data-testid="settings-save-success"]', { timeout: 5_000 });
    await expect(page.locator('[data-testid="settings-save-success"]')).toBeVisible();
  });

  test('navigates back to home', async ({ page }) => {
    await page.click('[data-testid="user-settings-button"]');
    await page.waitForSelector('[data-testid="settings-page"]');

    await page.click('[data-testid="settings-back-button"]');

    // Should return to main app view
    await expect(page.locator('[data-testid="settings-page"]')).not.toBeVisible();
  });
});
