/**
 * AI Translation tests
 * Mirrors: tests/mobile/test_ai_translation_mobile.py
 */
import { test, expect, loginUser } from './fixtures';

test('test_ai_translation_single_word_submission', async ({ page }) => {
  await loginUser(page);

  // Clean existing words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json());
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
    }
  });

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

  const quickInput = page.locator('#quick-word-input');
  await expect(quickInput).toBeVisible();
  await quickInput.fill('luminary - светило');

  await page.locator('#btn-quick-send').click();
  await page.waitForTimeout(400);

  const cardWord = page.locator('#card-word');
  await expect(cardWord).toBeVisible();
  await expect(cardWord).toHaveText('luminary');

  const cardPhonetic = page.locator('#card-phonetic');
  await expect(cardPhonetic).toBeVisible();
  expect((await cardPhonetic.innerText()).trim().length).toBeGreaterThan(0);

  // Flip card
  const card = page.locator('#flashcard');
  await card.click();
  await expect(card).toHaveClass(/(is-flipped|flipped)/);

  const cardTranslation = page.locator('#card-translation');
  await expect(cardTranslation).toBeVisible();
  await expect(cardTranslation).toHaveText('светило');

  const cardContext = page.locator('#card-context');
  await expect(cardContext).toBeVisible();
  expect(await cardContext.innerText()).toContain('luminary');
});

test('test_ai_translation_long_text_forms_named_lesson', async ({ page }) => {
  await loginUser(page);

  // Clean existing words and lessons
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existingWords = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json());
    for (const w of existingWords ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json());
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers });
    }
  });

  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.loadWordlist === 'function') (win.loadWordlist as () => void)();
    if (typeof win.loadLessons === 'function') (win.loadLessons as () => void)();
  });
  await page.waitForTimeout(300);

  await expect(page.locator('#lessons-view')).toBeVisible();

  // 1. Text with < 5 words should NOT create a lesson card
  const shortText = 'quick brown fox';
  const quickInput = page.locator('#quick-word-input');
  await expect(quickInput).toBeVisible();
  await quickInput.fill(shortText);

  await page.locator('#btn-quick-send').click();
  await page.waitForTimeout(500);

  await expect(page.locator('#multi-sentence-modal')).toBeHidden();
  await expect(page.locator('.lesson-card')).toBeHidden();
  await expect(page.locator('#lessons-empty')).toBeVisible();

  // 2. Text with >= 5 words automatically creates a lesson card without prompting
  const longText = 'The quick brown fox jumps over the lazy dog. It rests peacefully under the shade.';
  await quickInput.fill(longText);
  await page.locator('#btn-quick-send').click();

  // No prompt modal appears
  await expect(page.locator('#multi-sentence-modal')).toBeHidden();

  // Lesson card appears in grid
  const firstCard = page.locator('.lesson-card').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });

  // Wait for background lesson generation to complete
  await expect(firstCard).not.toHaveClass(/lesson-card-generating/, { timeout: 15000 });

  // Lesson card can be opened into lesson detail view
  await firstCard.click();
  const detailView = page.locator('#lesson-detail-view');
  await expect(detailView).toBeVisible({ timeout: 10000 });

  // Close lesson detail to view lesson card in grid
  const closeBtn = page.locator('#btn-close-lesson');
  await expect(closeBtn).toBeVisible();
  await closeBtn.click();
  await expect(page.locator('#lessons-view')).toBeVisible();
  await expect(firstCard).toBeVisible();
});
