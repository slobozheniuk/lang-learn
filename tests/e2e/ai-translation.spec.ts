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

  // Clean existing words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json());
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
    }
  });

  await expect(page.locator('#lessons-view')).toBeVisible();

  const longSentence = 'The quick brown fox jumps over the lazy dog and rests peacefully';
  const quickInput = page.locator('#quick-word-input');
  await expect(quickInput).toBeVisible();
  await quickInput.fill(longSentence);

  await page.locator('#btn-quick-send').click();
  await page.waitForTimeout(500);

  const lessonsGrid = page.locator('#lessons-grid');
  await expect(lessonsGrid).toBeVisible();

  const firstCard = page.locator('.lesson-card').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator('.lesson-title')).toContainText('Lesson');
  await expect(firstCard.locator('.lesson-badge')).toContainText('words');

  const pills = firstCard.locator('.lesson-word-pill');
  await expect(pills.first()).toBeVisible();
  expect(await pills.count()).toBeGreaterThanOrEqual(1);

  // Open lesson detail
  await firstCard.click();
  const detailView = page.locator('#lesson-detail-view');
  await expect(detailView).toBeVisible();

  const lessonCard = page.locator('#lesson-flashcard');
  await expect(lessonCard).toBeVisible();

  await lessonCard.click();
  await expect(lessonCard).toHaveClass(/is-flipped/);

  // Close lesson detail
  const closeBtn = page.locator('#btn-close-lesson');
  await expect(closeBtn).toBeVisible();
  await closeBtn.click();
  await expect(page.locator('#lessons-view')).toBeVisible();
});
