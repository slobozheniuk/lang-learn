import { test as base, expect, Page } from '@playwright/test';

export { expect };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Logs in using the Quick Demo Login button on the Auth screen (if not already
 * authenticated). Mirrors the Python `login_demo_user` conftest helper.
 */
export async function loginDemoUser(page: Page): Promise<void> {
  // Close the drawer if open
  const drawer = page.locator('#burger-menu-drawer');
  if (await drawer.isVisible()) {
    const closeBtn = page.locator('#drawer-close-btn');
    if (await closeBtn.isVisible()) await closeBtn.click();
  }

  const demoBtn = page.locator('#quick-demo-btn');
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await expect(page.locator('#lessons-view')).toBeVisible();
    // Clean up any leftover words/lessons from previous runs
    await page.evaluate(async () => {
      const token = localStorage.getItem('ll_token');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const words = await fetch('/api/v1/words/?limit=100', { headers })
        .then((r) => r.json())
        .catch(() => []);
      for (const w of words ?? []) {
        await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
      }
      const lessons = await fetch('/api/v1/lessons/?limit=100', { headers })
        .then((r) => r.json())
        .catch(() => []);
      for (const l of lessons ?? []) {
        await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Extended test with automatic per-test state reset
// ---------------------------------------------------------------------------

/**
 * Re-export base `test` extended with a `beforeEach` that clears localStorage
 * and navigates back to `/` so every test starts from a clean, unauthenticated
 * state — the same guarantee the old per-test fresh BrowserContext provided.
 */
export const test = base.extend<object>({
  page: async ({ page, baseURL }, use) => {
    // Start every test from a clean slate: clear any persisted auth token/state
    // and reload so the app renders the unauthenticated Auth screen.
    await page.goto(baseURL ?? '/');
    await page.evaluate(() => localStorage.clear());
    await page.goto(baseURL ?? '/');
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});
