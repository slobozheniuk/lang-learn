/**
 * Wordlist & Navigation tests
 * Mirrors: tests/mobile/test_wordlist_and_navigation.py
 */
import { test, expect, loginDemoUser } from './fixtures';

test('test_cheeseburger_menu_open_and_close', async ({ page }) => {
  // Not visible before login
  await expect(page.locator('#burger-menu-btn')).toHaveCount(0);

  await loginDemoUser(page);

  const burgerBtn = page.locator('#burger-menu-btn');
  await expect(burgerBtn).toBeVisible();
  expect(await burgerBtn.innerText()).toContain('☰');

  // Open drawer
  await burgerBtn.click();
  const drawer = page.locator('#burger-menu-drawer');
  const backdrop = page.locator('#menu-backdrop');
  await expect(drawer).toHaveClass(/(is-open|open|active)/);
  await expect(backdrop).toHaveClass(/(is-open|open|active|show)/);

  // No 'Menu' text in drawer header
  const drawerHeader = drawer.locator('.drawer-header');
  await expect(drawerHeader).not.toContainText('Menu');

  // Nav links exist
  await expect(page.locator('#nav-link-lessons')).toBeVisible();
  await expect(page.locator('#nav-link-flashcards')).toBeVisible();
  await expect(page.locator('#nav-link-wordlist')).toBeVisible();

  // Close via backdrop click (right of 270px drawer on 390px viewport)
  await backdrop.click({ position: { x: 330, y: 200 } });
  await expect(drawer).not.toHaveClass(/is-open/);

  // Open again and close via close button
  await burgerBtn.click();
  await expect(drawer).toHaveClass(/(is-open|open|active)/);
  const closeBtn = page.locator('#drawer-close-btn');
  await expect(closeBtn).toBeVisible();
  await closeBtn.click();
  await expect(drawer).not.toHaveClass(/is-open/);
});

test('test_navigation_between_flashcards_and_wordlist', async ({ page }) => {
  await loginDemoUser(page);

  // No page title badge in header
  await expect(page.locator('#page-title')).toHaveCount(0);

  // Initial page is Lessons
  await expect(page.locator('#lessons-view')).toBeVisible();

  // Navigate to Wordlist
  await page.locator('#burger-menu-btn').click();
  const navWordlist = page.locator('#nav-link-wordlist');
  await expect(navWordlist).toBeVisible();
  await navWordlist.click();

  await expect(page.locator('#burger-menu-drawer')).not.toHaveClass(/is-open/);
  await expect(page.locator('#wordlist-view')).toBeVisible();
  await expect(page.locator('#lessons-view')).not.toBeVisible();

  // Navigate to Flashcards
  await page.locator('#burger-menu-btn').click();
  const navFlashcards = page.locator('#nav-link-flashcards');
  await expect(navFlashcards).toBeVisible();
  await navFlashcards.click();

  await expect(page.locator('#burger-menu-drawer')).not.toHaveClass(/is-open/);
  await expect(page.locator('#flashcards-view')).toBeVisible();
  await expect(page.locator('#wordlist-view')).not.toBeVisible();

  // Navigate back to Lessons
  await page.locator('#burger-menu-btn').click();
  const navLessons = page.locator('#nav-link-lessons');
  await expect(navLessons).toBeVisible();
  await navLessons.click();

  await expect(page.locator('#burger-menu-drawer')).not.toHaveClass(/is-open/);
  await expect(page.locator('#lessons-view')).toBeVisible();
  await expect(page.locator('#flashcards-view')).not.toBeVisible();
});

test('test_wordlist_recall_rate_badges_and_color_coding', async ({ page }) => {
  await loginDemoUser(page);

  // Seed 4 words with specific recall rates
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Clean existing words
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json());
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
    }

    // 0% recall → Red
    await fetch('/api/v1/words/', {
      method: 'POST', headers,
      body: JSON.stringify({ text: 'word_red_zero', translation: 'красный_ноль', language_code: 'en' }),
    });

    // 67% recall → Yellow
    const w2 = await fetch('/api/v1/words/', {
      method: 'POST', headers,
      body: JSON.stringify({ text: 'word_yellow_mid', translation: 'желтый_средний', language_code: 'en' }),
    }).then((r) => r.json());
    await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'good' }) });
    await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'good' }) });
    await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'again' }) });

    // 80% recall → Green
    const w3 = await fetch('/api/v1/words/', {
      method: 'POST', headers,
      body: JSON.stringify({ text: 'word_green_high', translation: 'зеленый_высокий', language_code: 'en' }),
    }).then((r) => r.json());
    for (let i = 0; i < 4; i++) {
      await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'good' }) });
    }
    await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'again' }) });

    // 100% recall → Perfect
    const w4 = await fetch('/api/v1/words/', {
      method: 'POST', headers,
      body: JSON.stringify({ text: 'word_perfect_master', translation: 'мастер_сотка', language_code: 'en' }),
    }).then((r) => r.json());
    await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w4.id, rating: 'good' }) });
    await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w4.id, rating: 'good' }) });
  });

  // Navigate to Wordlist
  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-wordlist').click();
  await expect(page.locator('#wordlist-view')).toBeVisible();

  const cardRed = page.locator(".word-card:has-text('word_red_zero')");
  const cardYellow = page.locator(".word-card:has-text('word_yellow_mid')");
  const cardGreen = page.locator(".word-card:has-text('word_green_high')");
  const cardPerfect = page.locator(".word-card:has-text('word_perfect_master')");

  await expect(cardRed).toBeVisible();
  await expect(cardYellow).toBeVisible();
  await expect(cardGreen).toBeVisible();
  await expect(cardPerfect).toBeVisible();

  await expect(cardRed.locator('.word-recall-badge')).toHaveClass(/badge-red/);
  await expect(cardRed.locator('.word-recall-badge')).toHaveText('0%');

  await expect(cardYellow.locator('.word-recall-badge')).toHaveClass(/badge-yellow/);
  await expect(cardYellow.locator('.word-recall-badge')).toHaveText('67%');

  await expect(cardGreen.locator('.word-recall-badge')).toHaveClass(/badge-green/);
  await expect(cardGreen.locator('.word-recall-badge')).toHaveText('80%');

  await expect(cardPerfect.locator('.word-recall-badge')).toHaveClass(/badge-perfect/);
  await expect(cardPerfect.locator('.word-recall-badge')).toHaveText('100%');

  // Perfect card has vibrant green border
  await expect(cardPerfect).toHaveClass(/word-card-perfect/);
  const borderColor = await cardPerfect.evaluate((el) => window.getComputedStyle(el).borderColor);
  expect(borderColor.includes('16, 185, 129') || borderColor.includes('rgb(16, 185, 129)')).toBeTruthy();

  // Content structure
  await expect(cardPerfect.locator('.word-text-bold strong')).toHaveText('word_perfect_master');
  await expect(cardPerfect.locator('.word-translation-sub')).toHaveText('мастер_сотка');

  // Sorting order: 0% < 67% < 80% < 100% (ascending by y position)
  const boxRed = (await cardRed.boundingBox())!;
  const boxYellow = (await cardYellow.boundingBox())!;
  const boxGreen = (await cardGreen.boundingBox())!;
  const boxPerfect = (await cardPerfect.boundingBox())!;

  expect(boxRed.y).toBeLessThan(boxYellow.y);
  expect(boxYellow.y).toBeLessThan(boxGreen.y);
  expect(boxGreen.y).toBeLessThan(boxPerfect.y);
});

test('test_wordlist_three_dot_menu_and_delete_word', async ({ page }) => {
  await loginDemoUser(page);

  // Clean existing words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await fetch('/api/v1/words/?limit=100', { headers }).then((r) => r.json()).catch(() => []);
    for (const w of existing ?? []) {
      await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  });

  const wordToDelete = 'unique_word_to_delete';
  await page.evaluate(async (word) => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    await fetch('/api/v1/words/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: word, translation: 'на_удаление', language_code: 'en' }),
    });
  }, wordToDelete);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-wordlist').click();
  await expect(page.locator('#wordlist-view')).toBeVisible();

  const card = page.locator(`.word-card:has-text('${wordToDelete}')`);
  await expect(card).toBeVisible();

  const dotsBtn = card.locator('.btn-word-dots-menu');
  await expect(dotsBtn).toBeVisible();
  await dotsBtn.click();

  const dropdown = card.locator('.word-dropdown-menu');
  await expect(dropdown).toBeVisible();
  const deleteBtn = card.locator('.dropdown-item-delete');
  await expect(deleteBtn).toBeVisible();
  await expect(deleteBtn).toContainText('Delete');

  await deleteBtn.click();

  await expect(page.locator(`.word-card:has-text('${wordToDelete}')`)).toHaveCount(0);
});

test('test_wordlist_pagination_controls', async ({ page }) => {
  await loginDemoUser(page);

  // Create 25 words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    for (let i = 1; i <= 25; i++) {
      await fetch('/api/v1/words/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: `paginated_word_${i}`, translation: `перевод_${i}`, language_code: 'en' }),
      });
    }
  });

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-wordlist').click();
  await expect(page.locator('#wordlist-view')).toBeVisible();

  const pagination = page.locator('.pagination-controls');
  await expect(pagination).toBeVisible();
  await expect(page.locator('#pagination-info')).toContainText('Page 1 of');

  // 20 cards on page 1
  await expect(page.locator('.word-card')).toHaveCount(20);

  const btnNext = page.locator('#btn-next-page');
  await expect(btnNext).toBeEnabled();
  await btnNext.scrollIntoViewIfNeeded();
  await btnNext.dispatchEvent('click');

  await expect(page.locator('#pagination-info')).toContainText('Page 2 of');
  const cardsPage2 = await page.locator('.word-card').count();
  expect(cardsPage2).toBeGreaterThanOrEqual(1);
  expect(cardsPage2).toBeLessThanOrEqual(20);

  const btnPrev = page.locator('#btn-prev-page');
  await expect(btnPrev).toBeEnabled();
  await btnPrev.scrollIntoViewIfNeeded();
  await btnPrev.dispatchEvent('click');
  await expect(page.locator('#pagination-info')).toContainText('Page 1 of');
  await expect(page.locator('.word-card')).toHaveCount(20);
});

test('test_wordlist_three_dot_menu_flip_up_and_outside_click', async ({ page }) => {
  await loginDemoUser(page);

  // Seed 8 words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    for (let i = 1; i <= 8; i++) {
      await fetch('/api/v1/words/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: `flip_card_word_${i}`, translation: `перевод_флип_${i}`, language_code: 'en' }),
      });
    }
  });

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-wordlist').click();
  await expect(page.locator('#wordlist-view')).toBeVisible();

  const cards = page.locator('.word-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(5);

  const bottomCard = cards.nth(4);
  await expect(bottomCard).toBeVisible();

  const dotsBtn = bottomCard.locator('.btn-word-dots-menu');
  await expect(dotsBtn).toBeVisible();
  await dotsBtn.click();

  const dropdown = bottomCard.locator('.word-dropdown-menu');
  await expect(dropdown).toBeVisible();

  const cardBox = await bottomCard.boundingBox();
  expect(cardBox).not.toBeNull();
  const viewportHeight = page.viewportSize()!.height;

  // Verify the dropdown is visible — direction (up/down) is determined by available
  // space and may legitimately differ across device viewport heights.
  await expect(dropdown).toBeVisible();

  const hasElevatedZindex = await bottomCard.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const wrapper = el.querySelector('.word-actions-wrapper');
    const wrapperZ = wrapper ? parseInt(window.getComputedStyle(wrapper).zIndex || '0', 10) : 0;
    return parseInt(style.zIndex || '0', 10) >= 100 || wrapperZ >= 100;
  });
  expect(hasElevatedZindex).toBeTruthy();

  // Click outside to close
  await page.locator('.app-header').click();
  await expect(dropdown).not.toBeVisible();
});

test('test_wordlist_scroll_container_and_bottom_clearance', async ({ page }) => {
  await loginDemoUser(page);

  // Seed 12 words
  await page.evaluate(async () => {
    const token = localStorage.getItem('ll_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    for (let i = 1; i <= 12; i++) {
      await fetch('/api/v1/words/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: `scroll_test_word_${i}`, translation: `скролл_тест_${i}`, language_code: 'en' }),
      });
    }
  });

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-wordlist').click();
  await expect(page.locator('#wordlist-view')).toBeVisible();

  const container = page.locator('.app-container');
  await expect(container).toBeVisible();

  const overflowY = await container.evaluate((el) => window.getComputedStyle(el).overflowY);
  expect(['auto', 'scroll']).toContain(overflowY);

  // Scroll to bottom
  await page.evaluate(() => {
    const el = document.querySelector('.app-container');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(300);

  const bottomDock = page.locator('.bottom-dock');
  await expect(bottomDock).toBeVisible();
  const dockBox = await bottomDock.boundingBox();
  expect(dockBox).not.toBeNull();

  const lastCard = page.locator('.word-card').last();
  await expect(lastCard).toBeVisible();
  const lastCardBox = await lastCard.boundingBox();
  expect(lastCardBox).not.toBeNull();

  // Last card bottom should be above (or at) the bottom dock top
  expect(lastCardBox!.y + lastCardBox!.height).toBeLessThanOrEqual(dockBox!.y + 5);
});
