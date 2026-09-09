import { test, expect } from './fixtures';

test.describe('Lesson Detail View', () => {
  test('should open lesson detail, hide bottom dock, and restore dock on close', async ({
    page,
    login,
    lessonsPage,
    lessonDetailPage,
    dock,
  }) => {
    await login();



    // Seed backend lesson
    await page.evaluate(async () => {
      const token = localStorage.getItem('ll_token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      await fetch('/api/v1/lessons/generate-quiz', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: 'apple - яблоко\nbook - книга',
          title: 'Lesson 1',
          source_lang: 'ru',
          target_lang: 'en',
        }),
      });
    });

    await page.evaluate(() => (window as any).loadLessons?.());
    await page.waitForTimeout(300);

    // Bottom dock initially visible
    await dock.expectVisible();

    const card1 = lessonsPage.getLessonCard(1);
    await expect(card1).toBeVisible();
    await card1.click();

    // Lesson detail opens
    await lessonDetailPage.expectLoaded();
    await expect(lessonDetailPage.title).toHaveText('Lesson 1');

    // Bottom dock hidden
    await dock.expectHidden();

    await expect(page).toHaveScreenshot();

    // Close button visible
    await expect(lessonDetailPage.btnClose).toBeVisible();
    expect(await lessonDetailPage.btnClose.innerText()).toContain('✕');

    // Close returns to Lessons
    await lessonDetailPage.close();
    await lessonDetailPage.expectHidden();
    await lessonsPage.expectLoaded();
    await dock.expectVisible();
  });

  test('should select reading chunks and transition to quiz mode via Prepare Lesson', async ({
    page,
    login,
    dock,
    lessonsPage,
    lessonDetailPage,
  }) => {
    await login();



    // Submit text (16 words >= 5 words)
    await expect(dock.input).toBeVisible();
    await dock.input.fill("Yesterday I decided to get off the train and give up junk food. It was a great day.");
    await dock.btnSend.click();

    // Lesson card appears in grid without prompt modal
    const lessonCard = lessonsPage.lessonCards.first();
    await expect(lessonCard).toBeVisible({ timeout: 15000 });
    await expect(lessonCard).not.toHaveClass(/lesson-card-generating/, { timeout: 15000 });
    await page.waitForTimeout(300);
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

    // Click Prepare Lesson
    await lessonDetailPage.btnPrepareLesson.click();

    // Transition to Ilya Frank Dual-Pass Reading mode
    await expect(lessonDetailPage.frankContainer).toBeVisible({ timeout: 15000 });
    await expect(lessonDetailPage.frankGlosses.first()).toBeVisible();
    await expect(lessonDetailPage.btnFrankToQuiz).toBeVisible();

    // Transition to Quiz mode via Frank Reading Action Bar
    await lessonDetailPage.startQuizFromFrank();
    await expect(lessonDetailPage.quizContainer).toBeVisible({ timeout: 15000 });
    await expect(lessonDetailPage.btnModeQuiz).toHaveClass(/active/);
    await expect(lessonDetailPage.frankContainer).not.toBeVisible();

    await expect(page).toHaveScreenshot();
    const option0 = lessonDetailPage.getQuizOption(0);
    await expect(option0).toBeVisible();
    await option0.click();

    // Next question
    await expect(lessonDetailPage.btnNextQuizQuestion).toBeEnabled();
    await lessonDetailPage.btnNextQuizQuestion.click();

    // If there's another question, answer it too
    if (await lessonDetailPage.getQuizOption(0).isVisible()) {
      await lessonDetailPage.getQuizOption(0).click();
      await lessonDetailPage.btnNextQuizQuestion.click();
    }

    // Quiz completed
    await expect(lessonDetailPage.quizCompletedState).toBeVisible({ timeout: 10000 });

    // Back to Lessons
    await lessonDetailPage.btnFinishQuizBack.click();
    await lessonsPage.expectLoaded();
  });

  test('should toggle and persist highlight selection in interactive reading mode', async ({
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

  });

  test('should step through flashcards mode to completion state and restart lesson', async ({
    page,
    login,
    lessonsPage,
    lessonDetailPage,
  }) => {
    await login();



    // Seed backend lesson with 2 words
    await page.evaluate(async () => {
      const token = localStorage.getItem('ll_token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      await fetch('/api/v1/lessons/generate-quiz', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: 'study_word_1 - перевод_учеба_1\nstudy_word_2 - перевод_учеба_2',
          title: 'Lesson 1',
          source_lang: 'ru',
          target_lang: 'en',
        }),
      });
    });

    await page.evaluate(() => (window as any).loadLessons?.());
    await page.waitForTimeout(300);

    await lessonsPage.openLesson(1);
    await lessonDetailPage.expectLoaded();

    // Switch to flashcards study mode
    if (await lessonDetailPage.btnModeCards.isVisible()) {
      await lessonDetailPage.switchMode('cards');
    }

    await expect(lessonDetailPage.flashcard).toBeVisible();
    await expect(lessonDetailPage.flashcard).not.toHaveClass(/is-flipped/);
    await expect(page).toHaveScreenshot();
    await lessonDetailPage.flipCard();
    await expect(lessonDetailPage.flashcard).toHaveClass(/is-flipped/);

    // Next card
    await lessonDetailPage.nextCard();
    await expect(lessonDetailPage.cardCounter).toContainText('Card 2');

    // Step through all cards until completion
    let safetyCount = 0;
    while (!(await lessonDetailPage.cardCompletedState.isVisible()) && safetyCount < 20) {
      if (await lessonDetailPage.btnNextCard.isVisible()) {
        await lessonDetailPage.nextCard();
        await page.waitForTimeout(200);
      } else {
        break;
      }
      safetyCount++;
    }

    await expect(lessonDetailPage.cardCompletedState).toBeVisible();
    await expect(lessonDetailPage.cardCompletedTitle).toContainText('Lesson Completed');

    // Restart lesson
    await expect(lessonDetailPage.btnRestartLesson).toBeVisible();
    await lessonDetailPage.restartFlashcards();

    await expect(lessonDetailPage.flashcard).toBeVisible();
    await expect(lessonDetailPage.cardCounter).toContainText('Card 1');

    await lessonDetailPage.close();
    await lessonsPage.expectLoaded();
  });
});
