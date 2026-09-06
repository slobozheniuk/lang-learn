/**
 * Interactive Lesson Reading & Word Selection tests
 * Mirrors: tests/mobile/test_lesson_reading_selection_e2e.py
 */
import { test, expect, loginUser } from './fixtures';

test('test_reading_chunk_selection_and_prepare_lesson_flow', async ({ page }) => {
  await loginUser(page);

  // Clean existing lessons and words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const lessons = await fetch('/api/v1/lessons/', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of lessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const words = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of words ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

  // Submit multi-sentence text
  const dockInput = page.locator('#quick-word-input');
  await expect(dockInput).toBeVisible();
  await dockInput.fill("Yesterday I decided to get off the train and give up junk food. It was a great day.");
  await page.locator('#btn-quick-send').click();

  // Modal appears
  const modal = page.locator('#multi-sentence-modal');
  await expect(modal).toBeVisible({ timeout: 10000 });

  // Click Generate Quiz Lesson
  const btnGenerate = page.locator('#btn-generate-quiz-lesson');
  await expect(btnGenerate).toBeVisible();
  await btnGenerate.click();

  // Lesson opens in reading mode
  const readingContainer = page.locator('#reading-study-container');
  await expect(readingContainer).toBeVisible({ timeout: 15000 });

  const btnModeRead = page.locator('#btn-mode-reading');
  await expect(btnModeRead).toHaveClass(/active/);

  // Chips exist
  const chips = page.locator('.reading-chunk-chip');
  await expect(chips.first()).toBeVisible();

  // Prepare button disabled initially
  const btnPrepare = page.locator('#btn-prepare-lesson');
  await expect(btnPrepare).toBeVisible();
  await expect(btnPrepare).toBeDisabled();
  await expect(page.locator('#selected-chunks-count')).toContainText('0 words selected');

  // Select "get off"
  const getOffChip = page.locator('.reading-chunk-chip', { hasText: 'get off' }).first();
  await expect(getOffChip).toBeVisible();
  await getOffChip.click();
  await expect(getOffChip).toHaveClass(/chunk-highlighted/);
  await expect(page.locator('#selected-chunks-count')).toContainText('1 word selected');
  await expect(btnPrepare).toBeEnabled();

  // Select "give up"
  const giveUpChip = page.locator('.reading-chunk-chip', { hasText: 'give up' }).first();
  await expect(giveUpChip).toBeVisible();
  await giveUpChip.click();
  await expect(giveUpChip).toHaveClass(/chunk-highlighted/);
  await expect(page.locator('#selected-chunks-count')).toContainText('2 words selected');

  await expect(page).toHaveScreenshot();

  // Click Prepare Lesson
  await btnPrepare.click();

  // Transition to Quiz mode
  const quizContainer = page.locator('#quiz-study-container');
  await expect(quizContainer).toBeVisible({ timeout: 15000 });

  const btnModeQuiz = page.locator('#btn-mode-quiz');
  await expect(btnModeQuiz).toHaveClass(/active/);

  // Answer quiz question
  const option0 = page.locator('#quiz-option-0');
  await expect(option0).toBeVisible();
  await option0.click();

  await expect(page).toHaveScreenshot();

  // Next question
  const btnNextQ = page.locator('#btn-next-quiz-question');
  await expect(btnNextQ).toBeEnabled();
  await btnNextQ.click();

  // If there's another question, answer it too
  if (await page.locator('#quiz-option-0').isVisible()) {
    await page.locator('#quiz-option-0').click();
    await page.locator('#btn-next-quiz-question').click();
  }

  // Quiz completed
  await expect(page.locator('#quiz-completed-state')).toBeVisible({ timeout: 10000 });

  // Back to Lessons
  await page.locator('#btn-finish-quiz-back').click();
  await expect(page.locator('#lessons-view')).toBeVisible();
});

test('test_interactive_reading_unhighlight_toggle', async ({ page }) => {
  await loginUser(page);

  // Create reading lesson via API
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    await fetch('/api/v1/lessons/chunk-text', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: 'She decided to wake up and look forward to the adventure.',
        source_lang: 'ru',
        target_lang: 'en',
        create_lesson: true,
        title: 'Adventure Story',
      }),
    });
  });

  await page.reload();
  await expect(page.locator('#lessons-view')).toBeVisible();

  // Open the reading lesson
  const lessonCard = page.locator('.lesson-card', { hasText: 'Adventure Story' }).first();
  await expect(lessonCard).toBeVisible({ timeout: 10000 });
  await lessonCard.click();

  await expect(page.locator('#reading-study-container')).toBeVisible();

  // Tap "wake up"
  const chip = page.locator('.reading-chunk-chip', { hasText: 'wake up' }).first();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveClass(/chunk-highlighted/);
  await expect(page.locator('#selected-chunks-count')).toContainText('1 word selected');
  await expect(page.locator('#btn-prepare-lesson')).toBeEnabled();

  // Tap "wake up" again to untoggle
  await chip.click();
  await expect(chip).not.toHaveClass(/chunk-highlighted/);
  await expect(page.locator('#selected-chunks-count')).toContainText('0 words selected');
  await expect(page.locator('#btn-prepare-lesson')).toBeDisabled();

  // Close lesson
  await page.locator('#btn-close-lesson').click();
  await expect(page.locator('#lessons-view')).toBeVisible();

  // Clean up test lesson
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const lessons = await fetch('/api/v1/lessons/', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of lessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const words = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of words ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });
});
