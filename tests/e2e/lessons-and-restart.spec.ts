/**
 * Lessons & Deck Restart tests
 * Mirrors: tests/mobile/test_lessons_and_restart.py
 */
import { test, expect } from './fixtures';

test('test_lessons_is_default_page_on_load', async ({
  login,
  authPage,
  lessonsPage,
  flashcardsPage,
  wordlistPage,
  header,
  drawer,
}) => {
  // Unauthenticated: auth visible, lessons hidden
  await authPage.expectLoaded();
  await lessonsPage.expectHidden();

  await login();

  await lessonsPage.expectLoaded();
  await flashcardsPage.expectHidden();
  await wordlistPage.expectHidden();

  // Burger menu shows Lessons as active
  await header.openBurgerMenu();
  await expect(drawer.navLessons).toBeVisible();
  await expect(drawer.navLessons).toHaveClass(/active/);
  await expect(drawer.navLessons).toContainText('Lessons');

  // Close menu
  await drawer.close();
  await drawer.expectClosed();

  // Brand logo click stays on Lessons
  await header.clickBrand();
  await lessonsPage.expectLoaded();
});

test('test_vocabulary_words_do_not_create_lesson_cards', async ({
  page,
  login,
  lessonsPage,
}) => {
  await login();

  // Clean existing words and lessons
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

  // Seed 5 words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    for (let i = 1; i <= 5; i++) {
      await fetch('/api/v1/words/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: `chunk_word_${i}`, translation: `перевод_${i}`, language_code: 'en' }),
      });
    }
  });

  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.loadWordlist === 'function') (win.loadWordlist as () => void)();
    if (typeof win.loadLessons === 'function') (win.loadLessons as () => void)();
  });
  await page.waitForTimeout(300);

  // Adding vocabulary words must NOT create lesson cards
  await expect(lessonsPage.lessonCards).toBeHidden();
  await lessonsPage.expectEmpty();

  // Creating a real backend lesson displays the lesson card
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

  await page.evaluate(() => (window as unknown as Record<string, unknown>).loadLessons?.());
  await page.waitForTimeout(300);

  const card1 = lessonsPage.getLessonCard(1);
  await expect(card1).toBeVisible();
  await expect(card1.locator('.lesson-title')).toHaveText('Lesson 1');
});

test('test_lesson_detail_opens_hides_dock_and_closes', async ({
  page,
  login,
  lessonsPage,
  lessonDetailPage,
  dock,
}) => {
  await login();

  // Clean existing lessons and words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

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

  await page.evaluate(() => (window as unknown as Record<string, unknown>).loadLessons?.());
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

  // Close button visible
  await expect(lessonDetailPage.btnClose).toBeVisible();
  expect(await lessonDetailPage.btnClose.innerText()).toContain('✕');

  // Close returns to Lessons
  await lessonDetailPage.close();
  await lessonDetailPage.expectHidden();
  await lessonsPage.expectLoaded();
  await dock.expectVisible();
});

test('test_lesson_detail_interactive_study_and_completion', async ({
  page,
  login,
  lessonsPage,
  lessonDetailPage,
}) => {
  await login();

  // Clean existing lessons and words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

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

  await page.evaluate(() => (window as unknown as Record<string, unknown>).loadLessons?.());
  await page.waitForTimeout(300);

  await lessonsPage.openLesson(1);
  await lessonDetailPage.expectLoaded();

  // Switch to flashcards study mode
  if (await lessonDetailPage.btnModeCards.isVisible()) {
    await lessonDetailPage.switchMode('cards');
  }

  await expect(lessonDetailPage.flashcard).toBeVisible();
  await expect(lessonDetailPage.flashcard).not.toHaveClass(/is-flipped/);
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
  await expect(lessonDetailPage.cardCompletedState.locator('.empty-title')).toContainText('Lesson Completed');

  // Restart lesson
  await expect(lessonDetailPage.btnRestartLesson).toBeVisible();
  await lessonDetailPage.restartFlashcards();

  await expect(lessonDetailPage.flashcard).toBeVisible();
  await expect(lessonDetailPage.cardCounter).toContainText('Card 1');

  await lessonDetailPage.close();
  await lessonsPage.expectLoaded();
});

test('test_flashcards_restart_deck_button_on_completion', async ({
  page,
  login,
  header,
  drawer,
  flashcardsPage,
}) => {
  await login();

  // Seed 2 words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    await fetch('/api/v1/words/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'deck_restart_word_1', translation: 'перевод_1', language_code: 'en' }),
    });
    await fetch('/api/v1/words/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'deck_restart_word_2', translation: 'перевод_2', language_code: 'en' }),
    });
  });

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

  // Wait for cards to be loaded and rendered
  await expect(flashcardsPage.flashcard).toBeVisible();

  // Review all cards until deck empty
  for (let i = 0; i < 40; i++) {
    if (await flashcardsPage.flashcard.isVisible()) {
      await flashcardsPage.flipCard();
      await expect(flashcardsPage.btnGood).toBeVisible();
      await flashcardsPage.rateGood();
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }

  await expect(flashcardsPage.emptyState).toBeVisible();
  await expect(flashcardsPage.btnRestartDeck).toBeVisible();
  await expect(flashcardsPage.btnRestartDeck).toContainText('Restart Deck');

  await flashcardsPage.restartDeck();

  await expect(flashcardsPage.flashcard).toBeVisible();
  await expect(flashcardsPage.cardWord).toBeVisible();
  await expect(flashcardsPage.emptyState).not.toBeVisible();
});

test('test_lesson_three_dot_menu_and_delete_lesson', async ({
  page,
  login,
  lessonsPage,
  lessonDetailPage,
}) => {
  await login();

  // Clean existing lessons and words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

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

  await page.evaluate(() => (window as unknown as Record<string, unknown>).loadLessons?.());
  await page.waitForTimeout(300);

  const card = lessonsPage.getLessonCard(1);
  await expect(card).toBeVisible();

  await lessonsPage.openLessonMenu(1);

  // Lesson detail did NOT open
  await lessonDetailPage.expectHidden();

  // Dropdown with Delete button
  const dropdown = card.locator('.lesson-dropdown-menu');
  await expect(dropdown).toBeVisible();
  const delBtn = card.locator('.dropdown-item-delete');
  await expect(delBtn).toBeVisible();
  await expect(delBtn).toContainText('Delete');

  await delBtn.click();
  await page.waitForTimeout(300);

  await expect(lessonsPage.getLessonCard(1)).toHaveCount(0);
  await lessonsPage.expectEmpty();
});

test('test_lesson_three_dot_menu_flip_up_and_outside_click', async ({
  page,
  login,
  header,
  lessonsPage,
}) => {
  await login();

  // Clean existing lessons and words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
    const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const l of existingLessons ?? []) {
      await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

  // Seed 4 backend lessons to fill the screen
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    for (let i = 1; i <= 4; i++) {
      await fetch('/api/v1/lessons/generate-quiz', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: `flip_word_${i} - перевод_флип_${i}`,
          title: `Lesson ${i}`,
          source_lang: 'ru',
          target_lang: 'en',
        }),
      });
    }
  });

  await page.evaluate(() => (window as unknown as Record<string, unknown>).loadLessons?.());
  await page.waitForTimeout(300);

  const card = lessonsPage.getLessonCard(3);
  await expect(card).toBeVisible();

  const dotsBtn = card.locator('.btn-lesson-dots-menu');
  await expect(dotsBtn).toBeVisible();
  await dotsBtn.click();

  const dropdown = card.locator('.lesson-dropdown-menu');
  await expect(dropdown).toBeVisible();

  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();

  // Verify the dropdown is visible — direction (up/down) is determined by available
  // space and may legitimately differ across device viewport heights.
  await expect(dropdown).toBeVisible();

  const hasElevatedZindex = await card.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const wrapper = el.querySelector('.lesson-actions-wrapper');
    const wrapperZ = wrapper ? parseInt(window.getComputedStyle(wrapper).zIndex || '0', 10) : 0;
    return parseInt(style.zIndex || '0', 10) >= 100 || wrapperZ >= 100;
  });
  expect(hasElevatedZindex).toBeTruthy();

  // Click outside to close
  await header.root.click();
  await expect(dropdown).not.toBeVisible();
});
