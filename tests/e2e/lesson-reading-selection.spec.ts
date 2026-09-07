/**
 * Interactive Lesson Reading & Word Selection tests
 * Mirrors: tests/mobile/test_lesson_reading_selection_e2e.py
 */
import { test, expect } from './fixtures';

test('test_reading_chunk_selection_and_prepare_lesson_flow', async ({
  page,
  login,
  dock,
  lessonsPage,
  lessonDetailPage,
}) => {
  await login();

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

  // Submit text (16 words >= 5 words)
  await expect(dock.input).toBeVisible();
  await dock.input.fill("Yesterday I decided to get off the train and give up junk food. It was a great day.");
  await dock.btnSend.click();

  // Lesson card appears in grid without prompt modal
  const lessonCard = lessonsPage.lessonCards.first();
  await expect(lessonCard).toBeVisible({ timeout: 10000 });
  await expect(lessonCard).not.toHaveClass(/lesson-card-generating/, { timeout: 15000 });
  await lessonCard.click();

  // Lesson opens in reading mode
  await expect(lessonDetailPage.readingContainer).toBeVisible({ timeout: 15000 });
  await expect(lessonDetailPage.btnModeReading).toHaveClass(/active/);

  // Chips exist
  await expect(lessonDetailPage.readingChunks.first()).toBeVisible();

  // Prepare button disabled initially
  await expect(lessonDetailPage.btnPrepareLesson).toBeVisible();
  await expect(lessonDetailPage.btnPrepareLesson).toBeDisabled();
  await expect(lessonDetailPage.selectedChunksCount).toContainText('0 words selected');

  // Select "get off"
  const getOffChip = lessonDetailPage.readingChunks.filter({ hasText: 'get off' }).first();
  await expect(getOffChip).toBeVisible();
  await getOffChip.click();
  await expect(getOffChip).toHaveClass(/chunk-highlighted/);
  await expect(lessonDetailPage.selectedChunksCount).toContainText('1 word selected');
  await expect(lessonDetailPage.btnPrepareLesson).toBeEnabled();

  // Select "give up"
  const giveUpChip = lessonDetailPage.readingChunks.filter({ hasText: 'give up' }).first();
  await expect(giveUpChip).toBeVisible();
  await giveUpChip.click();
  await expect(giveUpChip).toHaveClass(/chunk-highlighted/);
  await expect(lessonDetailPage.selectedChunksCount).toContainText('2 words selected');

  await expect(page).toHaveScreenshot();

  // Click Prepare Lesson
  await lessonDetailPage.btnPrepareLesson.click();

  // Transition to Quiz mode
  await expect(lessonDetailPage.quizContainer).toBeVisible({ timeout: 15000 });
  await expect(lessonDetailPage.btnModeQuiz).toHaveClass(/active/);

  // Answer quiz question
  const option0 = page.locator('#quiz-option-0');
  await expect(option0).toBeVisible();
  await option0.click();

  await expect(page).toHaveScreenshot();

  // Next question
  await expect(lessonDetailPage.btnNextQuizQuestion).toBeEnabled();
  await lessonDetailPage.btnNextQuizQuestion.click();

  // If there's another question, answer it too
  if (await page.locator('#quiz-option-0').isVisible()) {
    await page.locator('#quiz-option-0').click();
    await lessonDetailPage.btnNextQuizQuestion.click();
  }

  // Quiz completed
  await expect(lessonDetailPage.quizCompletedState).toBeVisible({ timeout: 10000 });

  // Back to Lessons
  await lessonDetailPage.btnFinishQuizBack.click();
  await lessonsPage.expectLoaded();
});

test('test_interactive_reading_unhighlight_toggle', async ({
  page,
  login,
  lessonsPage,
  lessonDetailPage,
}) => {
  await login();

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
  await lessonsPage.expectLoaded();

  // Open the reading lesson
  const lessonCard = lessonsPage.lessonCards.filter({ hasText: 'Adventure Story' }).first();
  await expect(lessonCard).toBeVisible({ timeout: 10000 });
  await lessonCard.click();

  await expect(lessonDetailPage.readingContainer).toBeVisible();

  // Tap "wake up"
  const chip = lessonDetailPage.readingChunks.filter({ hasText: 'wake up' }).first();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveClass(/chunk-highlighted/);
  await expect(lessonDetailPage.selectedChunksCount).toContainText('1 word selected');
  await expect(lessonDetailPage.btnPrepareLesson).toBeEnabled();

  // Tap "wake up" again to untoggle
  await chip.click();
  await expect(chip).not.toHaveClass(/chunk-highlighted/);
  await expect(lessonDetailPage.selectedChunksCount).toContainText('0 words selected');
  await expect(lessonDetailPage.btnPrepareLesson).toBeDisabled();

  // Close lesson
  await lessonDetailPage.close();
  await lessonsPage.expectLoaded();

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
