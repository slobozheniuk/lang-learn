import { test, expect } from './fixtures';

test.describe('Quick Input & Ingestion', () => {
  test('should add single vocabulary word to wordlist without creating lesson', async ({
    login,
    lessonsPage,
    wordlistPage,
    dock,
    header,
    drawer,
  }) => {
    await login();

    // Clean start - no lessons
    await lessonsPage.expectLoaded();
    await lessonsPage.expectEmpty();

    // Type a single word and submit via button
    await dock.addWordOrText('ephemeral', 'button');

    // Verify lessons page still has no lesson cards
    await lessonsPage.expectEmpty();

    // Navigate to wordlist via drawer
    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');

    // The single word is in the wordlist
    await wordlistPage.expectLoaded();
    const wordItem = wordlistPage.getWordCard('ephemeral');
    await expect(wordItem).toBeVisible();

    // Lessons page still has no lessons
    await header.openBurgerMenu();
    await drawer.navigateTo('lessons');
    await lessonsPage.expectLoaded();
    await lessonsPage.expectEmpty();
  });

  test('should parse quick word with hyphen translation and show in review', async ({
    page,
    login,
    header,
    drawer,
    flashcardsPage,
    dock,
  }) => {
    await login();

    // Clean existing words
    await page.evaluate(async () => {
      const token = localStorage.getItem('ll_token');
      if (!token) return;
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
    expect(await flashcardsPage.cardPhonetic.innerText()).toBeTruthy();

    await flashcardsPage.flipCard();

    await expect(flashcardsPage.cardTranslation).toBeVisible();
    await flashcardsPage.expectCardTranslation('светило');

    await expect(flashcardsPage.cardContext).toBeVisible();
    expect(await flashcardsPage.cardContext.innerText()).toContain('luminary');
  });

  test('should process short text as vocabulary and long text as auto-generated lesson', async ({
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
      const w = window as any;
      w.loadLessons?.();
      w.loadWords?.();
    });
    await page.waitForTimeout(300);

    // 1. Text with < 5 words does NOT create a lesson card
    const shortText = 'The quick brown fox';
    await dock.input.fill(shortText);

    await dock.btnSend.click();
    await page.waitForTimeout(500);

    // Modal should remain hidden
    await expect(dock.multiSentenceModal).toBeHidden();
    await expect(lessonsPage.lessonCards).toBeHidden();
    await lessonsPage.expectEmpty();

    // 2. Text with >= 5 words automatically creates a lesson card without prompting
    const longText = 'The quick brown fox jumps over the lazy dog. It rests peacefully under the shade.';
    await dock.input.fill(longText);
    await dock.btnSend.click();

    // No prompt modal appears
    await expect(dock.multiSentenceModal).toBeHidden();

    // Lesson card appears in grid
    const firstCard = lessonsPage.lessonCards.first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Wait for background lesson generation to complete
    await expect(firstCard).not.toHaveClass(/lesson-card-generating/, { timeout: 15000 });
    await page.waitForTimeout(300);

    // Lesson card can be opened into lesson detail view
    await firstCard.click();
    await lessonDetailPage.expectLoaded();
    await expect(lessonDetailPage.readingChunks.first()).toBeVisible({ timeout: 5000 });
  });
});
