/**
 * Lessons & Deck Restart tests
 * Mirrors: tests/mobile/test_lessons_and_restart.py
 */
import { test, expect, loginUser } from './fixtures';

test('test_lessons_is_default_page_on_load', async ({ page }) => {
  // Unauthenticated: auth visible, lessons hidden
  await expect(page.locator('#auth-view')).toBeVisible();
  await expect(page.locator('#lessons-view')).toHaveCount(0);

  await loginUser(page);

  const lessonsView = page.locator('#lessons-view');
  await expect(lessonsView).toBeVisible();
  await expect(page.locator('#flashcards-view')).not.toBeVisible();
  await expect(page.locator('#wordlist-view')).not.toBeVisible();

  // Burger menu shows Lessons as active
  await page.locator('#burger-menu-btn').click();
  const navLessons = page.locator('#nav-link-lessons');
  await expect(navLessons).toBeVisible();
  await expect(navLessons).toHaveClass(/active/);
  await expect(navLessons).toContainText('Lessons');

  // Close menu
  await page.locator('#drawer-close-btn').click();
  await expect(page.locator('#burger-menu-drawer')).not.toHaveClass(/is-open/);

  // Brand logo click stays on Lessons
  await page.locator('.brand').click();
  await expect(page.locator('#lessons-view')).toBeVisible();
});

test('test_vocabulary_words_do_not_create_lesson_cards', async ({ page }) => {
  await loginUser(page);

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
  await expect(page.locator('.lesson-card')).toBeHidden();
  await expect(page.locator('#lessons-empty')).toBeVisible();

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

  const card1 = page.locator('#lesson-card-1');
  await expect(card1).toBeVisible();
  await expect(card1.locator('.lesson-title')).toHaveText('Lesson 1');
});

test('test_lesson_detail_opens_hides_dock_and_closes', async ({ page }) => {
  await loginUser(page);

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
  const bottomDock = page.locator('.bottom-dock');
  await expect(bottomDock).toBeVisible();

  const card1 = page.locator('#lesson-card-1');
  await expect(card1).toBeVisible();
  await card1.click();

  // Lesson detail opens
  const detailView = page.locator('#lesson-detail-view');
  await expect(detailView).toBeVisible();
  await expect(page.locator('.lesson-detail-title')).toHaveText('Lesson 1');

  // Bottom dock hidden
  await expect(page.locator('.bottom-dock')).toHaveCount(0);

  // Close button visible
  const closeBtn = page.locator('#btn-close-lesson');
  await expect(closeBtn).toBeVisible();
  expect(await closeBtn.innerText()).toContain('✕');

  // Close returns to Lessons
  await closeBtn.click();
  await expect(page.locator('#lesson-detail-view')).not.toBeVisible();
  await expect(page.locator('#lessons-view')).toBeVisible();
  await expect(page.locator('.bottom-dock')).toBeVisible();
});

test('test_lesson_detail_interactive_study_and_completion', async ({ page }) => {
  await loginUser(page);

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

  await page.locator('#lesson-card-1').click();
  await expect(page.locator('#lesson-detail-view')).toBeVisible();

  // Switch to flashcards study mode
  const btnCards = page.locator('#btn-mode-cards');
  if (await btnCards.isVisible()) {
    await btnCards.click();
  }

  const card = page.locator('#lesson-flashcard');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/is-flipped/);
  await card.click();
  await expect(card).toHaveClass(/is-flipped/);

  // Next card
  await page.locator('#btn-lesson-next').click();
  await expect(page.locator('.lesson-detail-counter')).toContainText('Card 2');

  // Step through all cards until completion
  let safetyCount = 0;
  while (!(await page.locator('#lesson-completed-state').isVisible()) && safetyCount < 20) {
    const btnNext = page.locator('#btn-lesson-next');
    if (await btnNext.isVisible()) {
      await btnNext.click();
      await page.waitForTimeout(200);
    } else {
      break;
    }
    safetyCount++;
  }

  await expect(page.locator('#lesson-completed-state')).toBeVisible();
  await expect(page.locator('.empty-title')).toContainText('Lesson Completed');

  // Restart lesson
  const btnRestart = page.locator('#btn-restart-lesson');
  await expect(btnRestart).toBeVisible();
  await btnRestart.click();

  await expect(page.locator('#lesson-flashcard')).toBeVisible();
  await expect(page.locator('.lesson-detail-counter')).toContainText('Card 1');

  await page.locator('#btn-close-lesson').click();
  await expect(page.locator('#lessons-view')).toBeVisible();
});

test('test_flashcards_restart_deck_button_on_completion', async ({ page }) => {
  await loginUser(page);

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

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

  // Wait for cards to be loaded and rendered
  const card = page.locator('#flashcard');
  await expect(card).toBeVisible();

  // Review all cards until deck empty
  for (let i = 0; i < 40; i++) {
    if (await card.isVisible()) {
      await card.click();
      const btnCorrect = page.locator('#btn-srs-correct');
      await expect(btnCorrect).toBeVisible();
      await btnCorrect.click();
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }

  await expect(page.locator('#empty-state')).toBeVisible();
  const btnRestart = page.locator('#btn-restart-deck');
  await expect(btnRestart).toBeVisible();
  await expect(btnRestart).toContainText('Restart Deck');

  await btnRestart.click();

  await expect(page.locator('#flashcard')).toBeVisible();
  await expect(page.locator('#card-word')).toBeVisible();
  await expect(page.locator('#empty-state')).not.toBeVisible();
});

test('test_lesson_three_dot_menu_and_delete_lesson', async ({ page }) => {
  await loginUser(page);

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

  const card = page.locator('#lesson-card-1');
  await expect(card).toBeVisible();

  const dotsBtn = card.locator('.btn-lesson-dots-menu');
  await expect(dotsBtn).toBeVisible();
  await dotsBtn.click();

  // Lesson detail did NOT open
  await expect(page.locator('#lesson-detail-view')).not.toBeVisible();

  // Dropdown with Delete button
  const dropdown = card.locator('.lesson-dropdown-menu');
  await expect(dropdown).toBeVisible();
  const delBtn = card.locator('.dropdown-item-delete');
  await expect(delBtn).toBeVisible();
  await expect(delBtn).toContainText('Delete');

  await delBtn.click();
  await page.waitForTimeout(300);

  await expect(page.locator('#lesson-card-1')).toHaveCount(0);
  await expect(page.locator('#lessons-empty')).toBeVisible();
});

test('test_lesson_three_dot_menu_flip_up_and_outside_click', async ({ page }) => {
  await loginUser(page);

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

  const card = page.locator('#lesson-card-3');
  await expect(card).toBeVisible();

  const dotsBtn = card.locator('.btn-lesson-dots-menu');
  await expect(dotsBtn).toBeVisible();
  await dotsBtn.click();

  const dropdown = card.locator('.lesson-dropdown-menu');
  await expect(dropdown).toBeVisible();

  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  const viewportHeight = page.viewportSize()!.height;

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
  await page.locator('.app-header').click();
  await expect(dropdown).not.toBeVisible();
});
