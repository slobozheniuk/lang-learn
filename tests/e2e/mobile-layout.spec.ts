import { test, expect } from './fixtures';

test.describe('Mobile Responsive Layout', () => {
  test('should maintain sticky header, scrollable app-container, and non-fixed dock', async ({
    page,
    login,
    authPage,
    header,
    drawer,
    dock,
    lessonsPage,
    flashcardsPage,
    wordlistPage,
  }) => {
    // Unauthenticated state checks
    await authPage.expectLoaded();
    await expect(authPage.formLogin).toBeVisible();
    await expect(header.btnBurger).toHaveCount(0);
    await expect(drawer.root).toHaveCount(0);
    await expect(dock.root).toHaveCount(0);
    await expect(lessonsPage.root).toHaveCount(0);
    await expect(flashcardsPage.root).toHaveCount(0);
    await expect(wordlistPage.root).toHaveCount(0);

    await login();

    // Header is at y=0
    await header.expectVisible();
    const headerBox = await header.root.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.y).toBe(0);

    await expect(header.btnBurger).toBeVisible();

    // Bottom dock is flush at viewport bottom
    await dock.expectVisible();
    const dockBox = await dock.root.boundingBox();
    expect(dockBox).not.toBeNull();
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    expect(Math.abs(dockBox!.y + dockBox!.height - viewportSize!.height)).toBeLessThan(2);

    // Bottom dock is not fixed positioned
    const dockPosition = await dock.root.evaluate((el) => window.getComputedStyle(el).position);
    expect(dockPosition).not.toBe('fixed');
    expect(['static', 'relative']).toContain(dockPosition);

    // Scroll container
    const container = lessonsPage.appContainer;
    await expect(container).toBeVisible();
    const overflowY = await container.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflowY);
    const flexGrow = await container.evaluate((el) => parseFloat(window.getComputedStyle(el).flexGrow));
    expect(flexGrow).toBeGreaterThanOrEqual(1);

    // No viewport overscroll
    const bodyOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
    const htmlOverflow = await page.evaluate(() => window.getComputedStyle(document.documentElement).overflow);
    expect(bodyOverflow.includes('hidden') || htmlOverflow.includes('hidden')).toBeTruthy();

    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    await expect(page).toHaveScreenshot();
  });

  test('should ensure scroll container has bottom clearance above dock', async ({
    page,
    login,
    header,
    drawer,
    wordlistPage,
    dock,
  }) => {
    await login();



    // Add 12 words so list exceeds viewport height
    await page.evaluate(async () => {
      const token = localStorage.getItem('ll_token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      for (let i = 1; i <= 12; i++) {
        await fetch('/api/v1/words/', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: `scroll_word_${i}`, translation: `перевод_${i}`, language_code: 'en' }),
        }).catch(() => {});
      }
    });

    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    // Wait for all 12 cards to render before measuring/scrolling
    await expect(wordlistPage.wordCards).toHaveCount(12);

    // App scroll container check
    const container = wordlistPage.appContainer;
    await expect(container).toBeVisible();

    const overflowY = await container.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflowY);

    // Scroll to bottom
    await page.evaluate(() => {
      const el = document.querySelector('.app-container');
      if (el) el.scrollTop = el.scrollHeight;
    });

    // Verify bottom card is completely above bottom dock
    const lastCard = wordlistPage.wordCards.nth(11);
    await expect(lastCard).toBeVisible();

    const lastCardBox = await lastCard.boundingBox();
    const dockBox = await dock.root.boundingBox();

    expect(lastCardBox).not.toBeNull();
    expect(dockBox).not.toBeNull();

    // In a flex layout where dock is static/relative below app-container,
    // the card bottom should not collide into or be obstructed by the dock
    expect(lastCardBox!.y + lastCardBox!.height).toBeLessThanOrEqual(dockBox!.y + 2);
  });

  test('should fit mobile viewport without horizontal overflow', async ({
    page,
    login,
    authPage,
    header,
    drawer,
    dock,
    flashcardsPage,
  }) => {
    await authPage.expectLoaded();
    const scrollWidthUnauth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidthUnauth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidthUnauth).toBeLessThanOrEqual(clientWidthUnauth);

    const viewportWidth = page.viewportSize()!.width;

    await login();

    await header.openBurgerMenu();
    await drawer.navigateTo('flashcards');
    await flashcardsPage.expectLoaded();

    if (await flashcardsPage.emptyState.isVisible()) {
      await dock.input.fill('gezellig - уютный');
      await dock.btnSend.click();
      await expect(flashcardsPage.cardWord).toHaveText('gezellig');
    }

    await flashcardsPage.flipCard();
    await expect(flashcardsPage.flashcard).toHaveClass(/is-flipped/);

    await expect(flashcardsPage.btnAgain).toBeVisible();
    await expect(flashcardsPage.btnAudio).toBeVisible();
    await expect(flashcardsPage.btnGood).toBeVisible();

    const wrongBox = (await flashcardsPage.btnAgain.boundingBox())!;
    const audioBox = (await flashcardsPage.btnAudio.boundingBox())!;
    const correctBox = (await flashcardsPage.btnGood.boundingBox())!;
    expect(wrongBox).not.toBeNull();
    expect(audioBox).not.toBeNull();
    expect(correctBox).not.toBeNull();
    expect(wrongBox.x).toBeGreaterThanOrEqual(0);
    expect(correctBox.x + correctBox.width).toBeLessThanOrEqual(viewportWidth);

    // No horizontal overflow across all views
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    await flashcardsPage.btnAgain.scrollIntoViewIfNeeded();

    await expect(page).toHaveScreenshot();
  });
});
