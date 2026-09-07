import { test, expect } from './fixtures';

test.describe('Flashcards SRS Review', () => {
  test('should flip review card front-to-back and back-to-front on click', async ({
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

    await dock.input.fill('ephemeral - мимолетный');
    await dock.btnSend.click();
    await page.waitForTimeout(400);

    await expect(flashcardsPage.flashcard).toBeVisible();
    await expect(flashcardsPage.flashcard).not.toHaveClass(/is-flipped/);

    // Flip front to back
    await flashcardsPage.flipCard();
    await expect(flashcardsPage.flashcard).toHaveClass(/is-flipped/);

    // Flip back to front
    await flashcardsPage.flipCard();
    await expect(flashcardsPage.flashcard).not.toHaveClass(/is-flipped/);
  });

  test('should trigger speech synthesis pronunciation on audio button click', async ({
    page,
    login,
    header,
    drawer,
    dock,
    flashcardsPage,
  }, testInfo) => {
    if (testInfo.project.name.includes('Safari')) {
      test.skip(true, 'Mocking window.speechSynthesis is unreliable in WebKit');
    }

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

  test('should submit SRS review rating and blur rating buttons', async ({
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

  test('should display newly added vocabulary in review session', async ({
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

    // Toast check
    await expect(flashcardsPage.toast).toHaveCount(0);
    await expect(flashcardsPage.cardWord).toBeVisible();
    await expect(dock.input).toHaveValue('');
    await expect(flashcardsPage.emptyState).not.toBeVisible();

    await expect(page).toHaveScreenshot();
  });

  test('should display review card stats, flip state, and empty review queue state', async ({
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

  test('should reset flashcards deck to first card when clicking restart deck button on completion', async ({
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
  });
});
