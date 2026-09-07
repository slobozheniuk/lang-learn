/**
 * AI Translation tests
 * Mirrors: tests/mobile/test_ai_translation_mobile.py
 */
import { test, expect } from './fixtures';

test('test_ai_translation_single_word_submission', async ({
  page,
  login,
  header,
  drawer,
  dock,
  flashcardsPage,
}) => {
  await login();

  // Clean existing words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json());
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
    }
  });

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

  await expect(dock.input).toBeVisible();
  await dock.input.fill('luminary - светило');

  await dock.btnSend.click();
  await page.waitForTimeout(400);

  await expect(flashcardsPage.cardWord).toBeVisible();
  await flashcardsPage.expectCardWord('luminary');

  await expect(flashcardsPage.cardPhonetic).toBeVisible();
  expect((await flashcardsPage.cardPhonetic.innerText()).trim().length).toBeGreaterThan(0);

  // Flip card
  await flashcardsPage.flipCard();
  await expect(flashcardsPage.flashcard).toHaveClass(/(is-flipped|flipped)/);

  await expect(flashcardsPage.cardTranslation).toBeVisible();
  await flashcardsPage.expectCardTranslation('светило');

  await expect(flashcardsPage.cardContext).toBeVisible();
  expect(await flashcardsPage.cardContext.innerText()).toContain('luminary');
});

test('test_ai_translation_long_text_forms_named_lesson', async ({
  page,
  login,
  lessonsPage,
  lessonDetailPage,
  dock,
}) => {
  await login();

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

  await lessonsPage.expectLoaded();

  // 1. Text with < 5 words should NOT create a lesson card
  const shortText = 'quick brown fox';
  await expect(dock.input).toBeVisible();
  await dock.input.fill(shortText);

  await dock.btnSend.click();
  await page.waitForTimeout(500);

  // No substitute in POM for #multi-sentence-modal: legacy modal check retained
  await expect(page.locator('#multi-sentence-modal')).toBeHidden();
  await expect(lessonsPage.lessonCards).toBeHidden();
  await lessonsPage.expectEmpty();

  // 2. Text with >= 5 words automatically creates a lesson card without prompting
  const longText = 'The quick brown fox jumps over the lazy dog. It rests peacefully under the shade.';
  await dock.input.fill(longText);
  await dock.btnSend.click();

  // No prompt modal appears (legacy modal locator)
  await expect(page.locator('#multi-sentence-modal')).toBeHidden();

  // Lesson card appears in grid
  const firstCard = lessonsPage.lessonCards.first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });

  // Wait for background lesson generation to complete
  await expect(firstCard).not.toHaveClass(/lesson-card-generating/, { timeout: 15000 });

  // Lesson card can be opened into lesson detail view
  await firstCard.click();
  await lessonDetailPage.expectLoaded();

  // Close lesson detail to view lesson card in grid
  await lessonDetailPage.close();
  await lessonsPage.expectLoaded();
  await expect(firstCard).toBeVisible();
});
