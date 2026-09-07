/**
 * Mobile App Layout & Core UI tests
 * Mirrors: tests/mobile/test_mobile_app.py
 */
import { test, expect } from './fixtures';

test('test_mobile_layout_and_fixed_elements', async ({
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
  const container = page.locator('.app-container');
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

test('test_auth_view_tabs_and_flow', async ({
  login,
  authPage,
  header,
  lessonsPage,
  settingsPage,
  dock,
}) => {
  await authPage.expectLoaded();
  await expect(authPage.formLogin).toBeVisible();

  // Switch to Register tab
  await authPage.switchTab('register');
  await expect(authPage.formRegister).toBeVisible();
  await expect(authPage.formLogin).not.toBeVisible();

  // Switch back to Sign In
  await authPage.switchTab('login');
  await expect(authPage.formLogin).toBeVisible();
  await expect(authPage.formRegister).not.toBeVisible();

  // Sign In with credentials
  const username = `test-${test.info().workerIndex}`;
  await authPage.login(username, username);

  await expect(header.btnSettings).toBeVisible();
  await lessonsPage.expectLoaded();
  await authPage.expectHidden();
  await expect(header.btnBurger).toBeVisible();

  // Navigate to Settings and Sign Out
  await header.openSettings();
  await settingsPage.expectLoaded();

  await expect(settingsPage.btnLogout).toBeVisible();
  await settingsPage.logout();

  // Back to unauthenticated state
  await authPage.expectLoaded();
  await expect(authPage.formLogin).toBeVisible();
  await expect(header.btnBurger).toHaveCount(0);
  await expect(lessonsPage.root).toHaveCount(0);
  await expect(dock.root).toHaveCount(0);
});

test('test_card_flip_front_to_back_and_reverse', async ({
  page,
  login,
  header,
  drawer,
  dock,
  flashcardsPage,
}) => {
  await login();

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

  if (await flashcardsPage.emptyState.isVisible()) {
    await dock.input.fill('luminary - светило');
    await dock.btnSend.click();
    await page.waitForTimeout(400);
    await expect(flashcardsPage.cardWord).toBeVisible();
  }

  await expect(flashcardsPage.flashcard).toBeVisible();
  await expect(flashcardsPage.flashcard).not.toHaveClass(/(is-flipped|flipped)/);

  // Flip front -> back
  await flashcardsPage.flipCard();
  await expect(flashcardsPage.flashcard).toHaveClass(/(is-flipped|flipped)/);

  await expect(flashcardsPage.cardTranslation).toBeVisible();
  const translationText = await flashcardsPage.cardTranslation.innerText();
  expect(translationText.trim().length).toBeGreaterThan(0);

  // Flip back -> front
  await flashcardsPage.flipCard();
  await expect(flashcardsPage.flashcard).not.toHaveClass(/(is-flipped|flipped)/);
  await expect(flashcardsPage.cardWord).toBeVisible();
});

test('test_sound_button_triggers_speech_synthesis', async ({
  page,
  browserName,
  login,
  header,
  drawer,
  dock,
  flashcardsPage,
}) => {
  // Web Speech API is unavailable in Playwright's headless WebKit — skip on Safari.
  test.skip(browserName === 'webkit', 'speechSynthesis not available in headless WebKit');
  await login();

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

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

  // Spy on speechSynthesis
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__spokenUtterances = [];
    const origSpeak = window.speechSynthesis ? window.speechSynthesis.speak.bind(window.speechSynthesis) : null;
    if (!window.speechSynthesis) {
      (window as unknown as Record<string, unknown>).speechSynthesis = {
        speak: (u: SpeechSynthesisUtterance) => {
          ((window as unknown as Record<string, unknown>).__spokenUtterances as Array<{text: string; lang: string}>).push({ text: u.text, lang: u.lang });
        },
        cancel: () => {},
        resume: () => {},
        paused: false,
      };
    } else {
      window.speechSynthesis.speak = (u) => {
        ((window as unknown as Record<string, unknown>).__spokenUtterances as Array<{text: string; lang: string}>).push({ text: u.text, lang: u.lang });
        if (origSpeak) { try { origSpeak(u); } catch { /* ignore */ } }
      };
    }
  });

  await dock.input.fill('sonder - осознание');
  await dock.btnSend.click();
  await page.waitForTimeout(400);
  await expect(flashcardsPage.cardWord).toBeVisible();

  await expect(flashcardsPage.btnAudio).toBeVisible();
  await flashcardsPage.pronounce();

  const spoken = await page.evaluate(() => (window as unknown as Record<string, unknown>).__spokenUtterances as Array<{text: string; lang: string}>);
  expect(spoken.length).toBeGreaterThanOrEqual(1);
  expect(spoken[spoken.length - 1].text.length).toBeGreaterThan(0);
  expect(spoken[spoken.length - 1].lang.toLowerCase()).toContain('en');
});

test('test_srs_buttons_submission_and_no_sticky_focus', async ({
  page,
  login,
  header,
  drawer,
  dock,
  flashcardsPage,
}) => {
  await login();

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

  await dock.input.fill('apple - яблоко');
  await dock.btnSend.click();
  await page.waitForTimeout(300);

  await dock.input.fill('banana - банан');
  await dock.btnSend.click();
  await page.waitForTimeout(300);

  // Flip card
  await flashcardsPage.flipCard();
  await expect(flashcardsPage.flashcard).toHaveClass(/is-flipped/);

  await expect(flashcardsPage.btnGood).toBeVisible();
  await expect(flashcardsPage.btnAgain).toBeVisible();

  await flashcardsPage.rateGood();

  const isActiveCorrect = await flashcardsPage.btnGood.evaluate((el) => document.activeElement === el);
  expect(isActiveCorrect).toBeFalsy();

  await page.waitForTimeout(400);

  if (await flashcardsPage.flashcard.isVisible()) {
    await flashcardsPage.flipCard();
    await flashcardsPage.rateAgain();
    const isActiveWrong = await flashcardsPage.btnAgain.evaluate((el) => document.activeElement === el);
    expect(isActiveWrong).toBeFalsy();
  }
});

test('test_word_addition_and_flashcard_display', async ({
  page,
  login,
  authPage,
  header,
  drawer,
  dock,
  flashcardsPage,
}) => {
  await authPage.expectLoaded();
  await login();

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

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

  await expect(dock.input).toBeVisible();
  await dock.input.fill('serendipity - счастливая случайность');

  await expect(dock.btnSend).toBeEnabled();
  await dock.btnSend.click();
  await page.waitForTimeout(400);

  // Toast check: no substitute in POM, direct check retained
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(flashcardsPage.cardWord).toBeVisible();
  await expect(dock.input).toHaveValue('');
  await expect(flashcardsPage.emptyState).not.toBeVisible();

  await expect(page).toHaveScreenshot();
});

test('test_flashcard_flip_and_srs_buttons_ui', async ({
  page,
  login,
  header,
  drawer,
  dock,
  flashcardsPage,
}) => {
  await login();

  await header.openBurgerMenu();
  await drawer.navigateTo('flashcards');
  await flashcardsPage.expectLoaded();

  if (await flashcardsPage.emptyState.isVisible()) {
    await dock.input.fill('ephemeral - мимолетный');
    await dock.btnSend.click();
    await expect(flashcardsPage.cardWord).toHaveText('ephemeral');
  }

  await expect(flashcardsPage.flashcard).toBeVisible();
  await expect(flashcardsPage.flashcard).not.toHaveClass(/is-flipped/);

  await flashcardsPage.flipCard();
  await expect(flashcardsPage.flashcard).toHaveClass(/is-flipped/);

  await expect(flashcardsPage.cardTranslation).toBeVisible();
  expect((await flashcardsPage.cardTranslation.innerText()).trim().length).toBeGreaterThan(0);

  await expect(flashcardsPage.ratingsWrapper).toBeVisible();

  await expect(flashcardsPage.btnAgain).toBeVisible();
  await expect(flashcardsPage.btnAudio).toBeVisible();
  await expect(flashcardsPage.btnGood).toBeVisible();

  expect((await flashcardsPage.btnAgain.innerText()).trim()).toBe('✕');
  expect((await flashcardsPage.btnAudio.innerText()).trim()).toBe('🔊');
  expect((await flashcardsPage.btnGood.innerText()).trim()).toBe('✓');

  // Button sizing (~44-60px, near-circular)
  for (const [name, btn] of [['Red ✕', flashcardsPage.btnAgain], ['Audio 🔊', flashcardsPage.btnAudio], ['Green ✓', flashcardsPage.btnGood]] as const) {
    const box = await btn.boundingBox();
    expect(box, `${name} bounding box`).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeLessThanOrEqual(60);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeLessThanOrEqual(60);
    expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(4);
  }

  // Left-to-right ordering
  const wrongBox = (await flashcardsPage.btnAgain.boundingBox())!;
  const audioBox = (await flashcardsPage.btnAudio.boundingBox())!;
  const correctBox = (await flashcardsPage.btnGood.boundingBox())!;

  expect(wrongBox.x + wrongBox.width).toBeLessThan(audioBox.x);
  expect(audioBox.x + audioBox.width).toBeLessThan(correctBox.x);
  expect(Math.abs(wrongBox.y - audioBox.y)).toBeLessThan(5);
  expect(Math.abs(audioBox.y - correctBox.y)).toBeLessThan(5);

  // Circular border-radius
  for (const btn of [flashcardsPage.btnAgain, flashcardsPage.btnAudio, flashcardsPage.btnGood]) {
    const radius = await btn.evaluate((el) => window.getComputedStyle(el).borderRadius);
    const isCircular =
      radius.includes('50%') ||
      radius.split(' ').some((p) => p.endsWith('px') && parseFloat(p) >= 24);
    expect(isCircular).toBeTruthy();
  }

  // Within viewport
  const viewportWidth = page.viewportSize()!.width;
  expect(wrongBox.x).toBeGreaterThanOrEqual(0);
  expect(wrongBox.x + wrongBox.width).toBeLessThanOrEqual(viewportWidth);
  expect(audioBox.x).toBeGreaterThanOrEqual(0);
  expect(audioBox.x + audioBox.width).toBeLessThanOrEqual(viewportWidth);
  expect(correctBox.x).toBeGreaterThanOrEqual(0);
  expect(correctBox.x + correctBox.width).toBeLessThanOrEqual(viewportWidth);

  // No horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  await expect(page).toHaveScreenshot();
});

test('test_mobile_viewport_no_overflow', async ({
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

  // All three buttons must be left-to-right and fully within the device viewport
  expect(wrongBox.x).toBeGreaterThanOrEqual(0);
  expect(audioBox.x).toBeGreaterThan(wrongBox.x);
  expect(correctBox.x + correctBox.width).toBeLessThanOrEqual(viewportWidth);

  // No horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  await flashcardsPage.btnAgain.scrollIntoViewIfNeeded();

  await expect(page).toHaveScreenshot();
});
