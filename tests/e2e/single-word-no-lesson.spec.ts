/**
 * Single word submission with no lesson creation
 * Mirrors: tests/mobile/test_single_word_no_lesson_e2e.py
 */
import { test, expect, loginDemoUser } from './fixtures';

test('test_single_word_submission_creates_no_lesson_e2e', async ({ page }) => {
  // 1. Ensure logged in
  await expect(page.locator('#auth-view')).toBeVisible();
  await loginDemoUser(page);

  // Clean existing lessons and words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existingWords = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existingWords ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

  // Refresh views
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.loadWordlist === 'function') (win.loadWordlist as () => void)();
    if (typeof win.loadLessons === 'function') (win.loadLessons as () => void)();
  });
  await page.waitForTimeout(300);

  // 2. Type a single word in the bottom dock
  const testWord = 'fiets';
  const testTranslation = 'велосипед';
  const quickInput = page.locator('#quick-word-input');
  await expect(quickInput).toBeVisible();
  await quickInput.fill(`${testWord} - ${testTranslation}`);

  const btnSend = page.locator('#btn-quick-send');
  await expect(btnSend).toBeEnabled();
  await btnSend.click();

  // Wait for input to clear
  await expect(quickInput).toHaveValue('');
  await page.waitForTimeout(500);

  // 3. Verify no backend lesson was created
  const backendLessonsCount = await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    return res.length;
  });
  expect(backendLessonsCount).toBe(0);

  // 4. Navigate to Wordlist
  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-wordlist').click();
  await expect(page.locator('#wordlist-view')).toBeVisible();

  // 5. Word IS present in wordlist
  const card = page.locator(`.word-card:has-text('${testWord}')`);
  await expect(card).toBeVisible();
});
