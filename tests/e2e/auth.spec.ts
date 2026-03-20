import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp } from './helpers';

test.describe('Auth screen', () => {
  test('shows auth screen when no session exists', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]', { timeout: 10_000 });
    await expect(page.locator('[data-testid="auth-screen"]')).toBeVisible();
  });

  test('shows email form by default', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]');

    await expect(page.locator('[data-testid="email-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="otp-form"]')).not.toBeVisible();
  });

  test('send OTP button is disabled with empty email', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]');

    await expect(page.locator('[data-testid="send-otp-button"]')).toBeDisabled();
  });

  test('transitions to OTP form after submitting email', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]');

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="send-otp-button"]');

    await page.waitForSelector('[data-testid="otp-form"]', { timeout: 5_000 });
    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-form"]')).not.toBeVisible();
  });

  test('back button from OTP step returns to email form', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]');

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="send-otp-button"]');
    await page.waitForSelector('[data-testid="otp-form"]');

    await page.click('[data-testid="back-to-email-button"]');

    await expect(page.locator('[data-testid="email-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="otp-form"]')).not.toBeVisible();
  });

  test('verify OTP button is disabled until 6 digits entered', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]');

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="send-otp-button"]');
    await page.waitForSelector('[data-testid="otp-form"]');

    await expect(page.locator('[data-testid="verify-otp-button"]')).toBeDisabled();
  });

  test('successful OTP verify transitions to terminal app', async ({ page }) => {
    await injectPreload(page, { session: null });
    await page.goto('/');
    await page.waitForSelector('[data-testid="auth-screen"]');

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="send-otp-button"]');
    await page.waitForSelector('[data-testid="otp-form"]');

    // InputOtp advances focus after each digit, so typing into the first input
    // fills all six as focus moves automatically.
    await page.locator('[aria-label="OTP digit 1"]').click();
    await page.keyboard.type('123456');

    await page.click('[data-testid="verify-otp-button"]');

    await waitForApp(page);
    await expect(page.locator('[data-testid="terminal-app"]')).toBeVisible();
  });

  test('skips auth screen when session already exists', async ({ page }) => {
    // Default preload has a valid session
    await injectPreload(page);
    await page.goto('/');
    await waitForApp(page);

    await expect(page.locator('[data-testid="terminal-app"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-screen"]')).not.toBeVisible();
  });
});
