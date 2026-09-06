/**
 * Mobile App Layout & Core UI tests
 * Mirrors: tests/mobile/test_mobile_app.py
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect, loginDemoUser } from './fixtures';

const SCREENSHOTS_DIR = path.resolve('tests/screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

test('test_mobile_layout_and_fixed_elements', async ({ page }) => {
  // Unauthenticated state checks
  await expect(page.locator('#auth-view')).toBeVisible();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#burger-menu-btn')).toHaveCount(0);
  await expect(page.locator('#burger-menu-drawer')).toHaveCount(0);
  await expect(page.locator('.bottom-dock')).toHaveCount(0);
  await expect(page.locator('#lessons-view')).toHaveCount(0);
  await expect(page.locator('#flashcards-view')).toHaveCount(0);
  await expect(page.locator('#wordlist-view')).toHaveCount(0);

  await loginDemoUser(page);

  // Header is at y=0
  const header = page.locator('.app-header');
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.y).toBe(0);

  await expect(page.locator('#burger-menu-btn')).toBeVisible();

  // Bottom dock is flush at viewport bottom
  const bottomDock = page.locator('.bottom-dock');
  await expect(bottomDock).toBeVisible();
  const dockBox = await bottomDock.boundingBox();
  expect(dockBox).not.toBeNull();
  const viewportSize = page.viewportSize();
  expect(viewportSize).not.toBeNull();
  expect(Math.abs(dockBox!.y + dockBox!.height - viewportSize!.height)).toBeLessThan(2);

  // Bottom dock is not fixed positioned
  const dockPosition = await bottomDock.evaluate((el) => window.getComputedStyle(el).position);
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

  const screenshotPath = path.join(SCREENSHOTS_DIR, 'mobile_layout_initial.png');
  await page.screenshot({ path: screenshotPath });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
  expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0);
});

test('test_auth_view_tabs_and_flow', async ({ page }) => {
  const authView = page.locator('#auth-view');
  await expect(authView).toBeVisible();
  await expect(page.locator('#login-form')).toBeVisible();

  // Switch to Register tab
  const tabRegister = page.locator('#tab-register');
  await expect(tabRegister).toBeVisible();
  await tabRegister.click();
  await expect(page.locator('#register-form')).toBeVisible();
  await expect(page.locator('#login-form')).not.toBeVisible();

  // Switch back to Sign In
  const tabLogin = page.locator('#tab-login');
  await expect(tabLogin).toBeVisible();
  await tabLogin.click();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#register-form')).not.toBeVisible();

  // Quick Demo Login
  const quickDemoBtn = page.locator('#quick-demo-btn');
  await expect(quickDemoBtn).toBeVisible();
  await quickDemoBtn.click();

  await expect(page.locator('#btn-settings')).toBeVisible();
  await expect(page.locator('#lessons-view')).toBeVisible();
  await expect(page.locator('#auth-view')).toHaveCount(0);
  await expect(page.locator('#burger-menu-btn')).toBeVisible();

  // Navigate to Settings and Sign Out
  await page.locator('#btn-settings').click();
  await expect(page.locator('#settings-view')).toBeVisible();

  const btnLogout = page.locator('#btn-logout');
  await expect(btnLogout).toBeVisible();
  await btnLogout.click();

  // Back to unauthenticated state
  await expect(page.locator('#auth-view')).toBeVisible();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#burger-menu-btn')).toHaveCount(0);
  await expect(page.locator('#lessons-view')).toHaveCount(0);
  await expect(page.locator('.bottom-dock')).toHaveCount(0);
});

test('test_card_flip_front_to_back_and_reverse', async ({ page }) => {
  await loginDemoUser(page);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

  if (await page.locator('#empty-state').isVisible()) {
    await page.locator('#quick-word-input').fill('luminary - светило');
    await page.locator('#btn-quick-send').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#card-word')).toBeVisible();
  }

  const card = page.locator('#flashcard');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/(is-flipped|flipped)/);

  // Flip front -> back
  await card.click();
  await expect(card).toHaveClass(/(is-flipped|flipped)/);

  const translation = page.locator('#card-translation');
  await expect(translation).toBeVisible();
  const translationText = await translation.innerText();
  expect(translationText.trim().length).toBeGreaterThan(0);

  // Flip back -> front
  await card.click();
  await expect(card).not.toHaveClass(/(is-flipped|flipped)/);
  await expect(page.locator('#card-word')).toBeVisible();
});

test('test_sound_button_triggers_speech_synthesis', async ({ page, browserName }) => {
  // Web Speech API is unavailable in Playwright's headless WebKit — skip on Safari.
  test.skip(browserName === 'webkit', 'speechSynthesis not available in headless WebKit');
  await loginDemoUser(page);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

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

  await page.locator('#quick-word-input').fill('sonder - осознание');
  await page.locator('#btn-quick-send').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#card-word')).toBeVisible();

  const btnAudio = page.locator('#btn-audio');
  await expect(btnAudio).toBeVisible();
  await btnAudio.click();

  const spoken = await page.evaluate(() => (window as unknown as Record<string, unknown>).__spokenUtterances as Array<{text: string; lang: string}>);
  expect(spoken.length).toBeGreaterThanOrEqual(1);
  expect(spoken[spoken.length - 1].text.length).toBeGreaterThan(0);
  expect(spoken[spoken.length - 1].lang.toLowerCase()).toContain('en');
});

test('test_srs_buttons_submission_and_no_sticky_focus', async ({ page }) => {
  await loginDemoUser(page);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

  await page.locator('#quick-word-input').fill('apple - яблоко');
  await page.locator('#btn-quick-send').click();
  await page.waitForTimeout(300);

  await page.locator('#quick-word-input').fill('banana - банан');
  await page.locator('#btn-quick-send').click();
  await page.waitForTimeout(300);

  // Flip card
  await page.locator('#flashcard').click();
  await expect(page.locator('#flashcard')).toHaveClass(/is-flipped/);

  const btnCorrect = page.locator('#btn-srs-correct');
  const btnWrong = page.locator('#btn-srs-wrong');
  await expect(btnCorrect).toBeVisible();
  await expect(btnWrong).toBeVisible();

  await btnCorrect.click();

  const isActiveCorrect = await btnCorrect.evaluate((el) => document.activeElement === el);
  expect(isActiveCorrect).toBeFalsy();

  await page.waitForTimeout(400);

  if (await page.locator('#flashcard').isVisible()) {
    await page.locator('#flashcard').click();
    await btnWrong.click();
    const isActiveWrong = await btnWrong.evaluate((el) => document.activeElement === el);
    expect(isActiveWrong).toBeFalsy();
  }
});

test('test_word_addition_and_flashcard_display', async ({ page }) => {
  await expect(page.locator('#auth-view')).toBeVisible();
  await loginDemoUser(page);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

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

  const quickInput = page.locator('#quick-word-input');
  await expect(quickInput).toBeVisible();
  await quickInput.fill('serendipity - счастливая случайность');

  const btnSend = page.locator('#btn-quick-send');
  await expect(btnSend).toBeEnabled();
  await btnSend.click();
  await page.waitForTimeout(400);

  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.locator('#card-word')).toBeVisible();
  await expect(quickInput).toHaveValue('');
  await expect(page.locator('#empty-state')).not.toBeVisible();

  const screenshotPath = path.join(SCREENSHOTS_DIR, 'mobile_card_front.png');
  await page.screenshot({ path: screenshotPath });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
  expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0);
});

test('test_flashcard_flip_and_srs_buttons_ui', async ({ page }) => {
  await loginDemoUser(page);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

  if (await page.locator('#empty-state').isVisible()) {
    await page.locator('#quick-word-input').fill('ephemeral - мимолетный');
    await page.locator('#btn-quick-send').click();
    await expect(page.locator('#card-word')).toHaveText('ephemeral');
  }

  const card = page.locator('#flashcard');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/is-flipped/);

  await card.click();
  await expect(card).toHaveClass(/is-flipped/);

  const translation = page.locator('#card-translation');
  await expect(translation).toBeVisible();
  expect((await translation.innerText()).trim().length).toBeGreaterThan(0);

  const ratingsWrapper = page.locator('#srs-ratings-wrapper');
  await expect(ratingsWrapper).toBeVisible();

  const btnWrong = page.locator('#btn-srs-wrong');
  const btnAudio = page.locator('#btn-audio');
  const btnCorrect = page.locator('#btn-srs-correct');

  await expect(btnWrong).toBeVisible();
  await expect(btnAudio).toBeVisible();
  await expect(btnCorrect).toBeVisible();

  expect((await btnWrong.innerText()).trim()).toBe('✕');
  expect((await btnAudio.innerText()).trim()).toBe('🔊');
  expect((await btnCorrect.innerText()).trim()).toBe('✓');

  // Button sizing (~44-60px, near-circular)
  for (const [name, btn] of [['Red ✕', btnWrong], ['Audio 🔊', btnAudio], ['Green ✓', btnCorrect]] as const) {
    const box = await btn.boundingBox();
    expect(box, `${name} bounding box`).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeLessThanOrEqual(60);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeLessThanOrEqual(60);
    expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(4);
  }

  // Left-to-right ordering
  const wrongBox = (await btnWrong.boundingBox())!;
  const audioBox = (await btnAudio.boundingBox())!;
  const correctBox = (await btnCorrect.boundingBox())!;

  expect(wrongBox.x + wrongBox.width).toBeLessThan(audioBox.x);
  expect(audioBox.x + audioBox.width).toBeLessThan(correctBox.x);
  expect(Math.abs(wrongBox.y - audioBox.y)).toBeLessThan(5);
  expect(Math.abs(audioBox.y - correctBox.y)).toBeLessThan(5);

  // Circular border-radius
  for (const btn of [btnWrong, btnAudio, btnCorrect]) {
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

  const screenshotPath = path.join(SCREENSHOTS_DIR, 'mobile_card_back_srs.png');
  await page.screenshot({ path: screenshotPath });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
  expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0);
});

test('test_mobile_viewport_no_overflow', async ({ page }) => {
  await expect(page.locator('#auth-view')).toBeVisible();
  const scrollWidthUnauth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidthUnauth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidthUnauth).toBeLessThanOrEqual(clientWidthUnauth);

  const viewportWidth = page.viewportSize()!.width;

  await loginDemoUser(page);

  await page.locator('#burger-menu-btn').click();
  await page.locator('#nav-link-flashcards').click();
  await expect(page.locator('#flashcards-view')).toBeVisible();

  if (await page.locator('#empty-state').isVisible()) {
    await page.locator('#quick-word-input').fill('gezellig - уютный');
    await page.locator('#btn-quick-send').click();
    await expect(page.locator('#card-word')).toHaveText('gezellig');
  }

  await page.locator('#flashcard').click();
  await expect(page.locator('#flashcard')).toHaveClass(/is-flipped/);

  const btnWrong = page.locator('#btn-srs-wrong');
  const btnAudio = page.locator('#btn-audio');
  const btnCorrect = page.locator('#btn-srs-correct');

  await expect(btnWrong).toBeVisible();
  await expect(btnAudio).toBeVisible();
  await expect(btnCorrect).toBeVisible();

  const wrongBox = (await btnWrong.boundingBox())!;
  const audioBox = (await btnAudio.boundingBox())!;
  const correctBox = (await btnCorrect.boundingBox())!;
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

  await btnWrong.scrollIntoViewIfNeeded();

  const screenshotPath = path.join(SCREENSHOTS_DIR, 'mobile_viewport_no_overflow.png');
  await page.screenshot({ path: screenshotPath });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
  expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0);
});

test('test_visual_screenshots_generated', async ({ page }) => {
  // This test validates previously generated screenshots exist.
  // In practice it will be accurate only if the screenshot-generating tests ran first.
  const expectedScreenshots = [
    'mobile_layout_initial.png',
    'mobile_card_front.png',
    'mobile_card_back_srs.png',
    'mobile_viewport_no_overflow.png',
  ];

  for (const filename of expectedScreenshots) {
    const p = path.join(SCREENSHOTS_DIR, filename);
    expect(fs.existsSync(p), `Expected screenshot ${filename} to exist`).toBeTruthy();
    expect(
      fs.statSync(p).size,
      `Screenshot ${filename} should be > 1000 bytes`
    ).toBeGreaterThan(1000);
  }
});
