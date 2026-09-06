import { test as base, expect, Page } from '@playwright/test';

export { expect };

export interface WorkerUser {
  username: string;
  password: string;
  token: string;
}

const workerUserCache = new Map<number, WorkerUser>();

/**
 * Ensures the worker user exists by attempting login, falling back to registration.
 * Caches and returns the user credentials and JWT access token.
 */
async function ensureWorkerUser(baseURL: string, workerIndex: number): Promise<WorkerUser> {
  const normalizedBase = baseURL.replace(/\/$/, '');
  const username = `test-${workerIndex}`;
  const password = `test-${workerIndex}`;

  const cached = workerUserCache.get(workerIndex);
  if (cached) {
    return cached;
  }

  // 1. Check if user already exists by attempting login
  try {
    const loginRes = await fetch(`${normalizedBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: username, password }),
    });

    if (loginRes.ok) {
      const data = (await loginRes.json()) as { access_token: string };
      const user: WorkerUser = { username, password, token: data.access_token };
      workerUserCache.set(workerIndex, user);
      return user;
    }
  } catch {
    // Fall through to register attempt
  }

  // 2. If not available, register the user via API
  const regRes = await fetch(`${normalizedBase}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      source_language: 'ru',
      target_language: 'en',
    }),
  });

  if (regRes.ok) {
    const data = (await regRes.json()) as { token: { access_token: string } };
    const user: WorkerUser = { username, password, token: data.token.access_token };
    workerUserCache.set(workerIndex, user);
    return user;
  }

  // If registration returned 400 (already exists, e.g. from a race), try login once more
  if (regRes.status === 400) {
    const retryLogin = await fetch(`${normalizedBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: username, password }),
    });
    if (retryLogin.ok) {
      const data = (await retryLogin.json()) as { access_token: string };
      const user: WorkerUser = { username, password, token: data.access_token };
      workerUserCache.set(workerIndex, user);
      return user;
    }
  }

  const err = await regRes.text();
  throw new Error(`Failed to create worker user ${username}: HTTP ${regRes.status} – ${err}`);
}

/**
 * Cleans up all words and lessons for a given worker user via backend API.
 */
async function cleanupUserDatabase(baseURL: string, token: string): Promise<void> {
  const normalizedBase = baseURL.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const words = await fetch(`${normalizedBase}/api/v1/words/?limit=100`, { headers })
      .then((r) => r.json())
      .catch(() => []);
    for (const w of words ?? []) {
      await fetch(`${normalizedBase}/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors
  }

  try {
    const lessons = await fetch(`${normalizedBase}/api/v1/lessons/?limit=100`, { headers })
      .then((r) => r.json())
      .catch(() => []);
    for (const l of lessons ?? []) {
      await fetch(`${normalizedBase}/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Logs in the current worker's user via the UI login form.
 */
export async function loginUser(page: Page, user?: WorkerUser): Promise<void> {
  const workerIndex = test.info().workerIndex;
  const username = user?.username ?? `test-${workerIndex}`;
  const password = user?.password ?? `test-${workerIndex}`;

  // Close burger menu drawer if open
  const drawer = page.locator('#burger-menu-drawer');
  if (await drawer.isVisible()) {
    const closeBtn = page.locator('#drawer-close-btn');
    if (await closeBtn.isVisible()) await closeBtn.click();
  }

  // If on Auth screen, fill the login form
  const authView = page.locator('#auth-view');
  if (await authView.isVisible()) {
    const tabLogin = page.locator('#tab-login');
    if (await tabLogin.isVisible()) await tabLogin.click();

    await page.locator('#login-identifier').fill(username);
    await page.locator('#login-password').fill(password);
    await page.locator('#btn-login-submit').click();
    await expect(page.locator('#lessons-view')).toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// Extended test fixture
// ---------------------------------------------------------------------------

export const test = base.extend<
  {
    login: () => Promise<void>;
  },
  {
    workerUser: WorkerUser;
  }
>({
  // Worker-scoped fixture: ensures the worker's user is registered once per worker process
  workerUser: [
    async ({}, use, workerInfo) => {
      const port = process.env.TEST_PORT ?? 8899;
      const baseURL = `http://127.0.0.1:${port}`;
      const user = await ensureWorkerUser(baseURL, workerInfo.workerIndex);
      await use(user);
    },
    { scope: 'worker' },
  ],

  // Test-scoped fixture: cleans up worker DB data & resets localStorage
  page: async ({ page, baseURL, workerUser }, use) => {
    const base = baseURL ?? `http://127.0.0.1:${process.env.TEST_PORT ?? 8899}`;

    // Clean up any words/lessons from prior tests on this worker BEFORE rendering the page
    await cleanupUserDatabase(base, workerUser.token);

    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    await use(page);
  },

  // Test fixture providing a convenient login function
  login: async ({ page, workerUser }, use) => {
    await use(async () => {
      await loginUser(page, workerUser);
    });
  },
});
