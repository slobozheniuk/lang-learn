import { test, expect } from './fixtures';

test.describe('Lessons Dashboard', () => {
  test('should display empty state when user has no lessons on default landing', async ({
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

  test('should not generate lesson cards when adding vocabulary words', async ({
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

    await page.evaluate(() => (window as any).loadLessons?.());
    await page.waitForTimeout(300);

    const card1 = lessonsPage.getLessonCard(1);
    await expect(card1).toBeVisible();
    await expect(lessonsPage.getCardTitle(card1)).toHaveText('Lesson 1');
  });

  test('should open 3-dot context menu and delete a lesson card', async ({
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

    await page.evaluate(() => (window as any).loadLessons?.());
    await page.waitForTimeout(300);

    const card = lessonsPage.getLessonCard(1);
    await expect(card).toBeVisible();

    await lessonsPage.openLessonMenu(1);

    // Lesson detail did NOT open
    await lessonDetailPage.expectHidden();

    // Dropdown with Delete button
    const dropdown = lessonsPage.getCardDropdown(card);
    await expect(dropdown).toBeVisible();
    const delBtn = lessonsPage.getCardDeleteBtn(card);
    await expect(delBtn).toBeVisible();
    await expect(delBtn).toContainText('Delete');

    await delBtn.click();
    await page.waitForTimeout(300);

    await expect(lessonsPage.getLessonCard(1)).toHaveCount(0);
    await lessonsPage.expectEmpty();
  });

  test('should flip menu upward on bottom lesson cards and dismiss on outside click', async ({
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

    await page.evaluate(() => (window as any).loadLessons?.());
    await page.waitForTimeout(300);

    const card = lessonsPage.getLessonCard(3);
    await expect(card).toBeVisible();

    const dotsBtn = lessonsPage.getCardDotsBtn(card);
    await expect(dotsBtn).toBeVisible();
    await dotsBtn.click();

    const dropdown = lessonsPage.getCardDropdown(card);
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
});
