import { test, expect } from '@playwright/test';
import { injectPreload, waitForApp, setStoreState, TEST_USER } from './helpers';

const GROUP_ID = 'group-settings-test-1';
const GROUP_SLUG = 'test-engineering';

test.describe('Edit group settings', () => {
  test.beforeEach(async ({ page }) => {
    // Start with no groups so React Query doesn't overwrite our injected state
    await injectPreload(page, { groups: [] });
    await page.goto('/');
    await waitForApp(page);

    // Wait for React Query's initial list_user_groups fetch to settle
    // (it returns empty, staleTime=30s so it won't refetch after we inject)
    await page.waitForTimeout(100);

    // Inject a group with a real slug directly into Zustand
    await setStoreState(page, {
      groups: [
        {
          id: GROUP_ID,
          slug: GROUP_SLUG,
          name: 'Test Engineering',
          description: 'Test engineering group',
          created_by: TEST_USER.id,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
      selectedGroupId: GROUP_ID,
    } as any);

    // Navigate within the SPA (no full page reload, so Zustand state persists)
    await page.evaluate((slug) => {
      window.history.pushState({}, '', `/g/${slug}/settings`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, GROUP_SLUG);

    await page.waitForSelector('[data-testid="group-settings-page"]', { timeout: 5_000 });
  });

  test('shows group settings page with correct group', async ({ page }) => {
    await expect(page.locator('[data-testid="group-settings-page"]')).toBeVisible();
  });

  test('loads existing group name', async ({ page }) => {
    await page.waitForFunction(() => {
      const input = document.querySelector('[data-testid="group-settings-name-input"]') as HTMLInputElement;
      return input && input.value !== '';
    }, { timeout: 5_000 });

    const nameValue = await page.inputValue('[data-testid="group-settings-name-input"]');
    expect(nameValue).toBe('Test Engineering');
  });

  test('saves updated group name', async ({ page }) => {
    await page.waitForFunction(() => {
      const input = document.querySelector('[data-testid="group-settings-name-input"]') as HTMLInputElement;
      return input && input.value !== '';
    }, { timeout: 5_000 });

    await page.fill('[data-testid="group-settings-name-input"]', 'Renamed Engineering');
    await page.click('[data-testid="group-settings-save-button"]');

    // api.updateGroup is a console.warn stub that resolves OK, so save succeeds
    await page.waitForSelector('[data-testid="group-settings-save-success"]', { timeout: 5_000 });
    await expect(page.locator('[data-testid="group-settings-save-success"]')).toBeVisible();
  });

  test('navigates back from group settings', async ({ page }) => {
    await page.click('[data-testid="group-settings-back-button"]');
    await expect(page.locator('[data-testid="group-settings-page"]')).not.toBeVisible();
  });
});
