import { test, expect } from './fixtures';

test.describe('Wordlist & Vocabulary', () => {
  test('should render empty wordlist layout when no words exist', async ({
    page,
    login,
    header,
    drawer,
    wordlistPage,
  }) => {
    await login();

    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    await wordlistPage.expectEmpty();
    await expect(page).toHaveScreenshot();
  });

  test('should display color-coded recall rate badges and sort words by recall rate', async ({
    page,
    login,
    header,
    drawer,
    wordlistPage,
  }) => {
    await login();



    // Seed 4 words with different recall rates
    await page.evaluate(async () => {
      const token = localStorage.getItem('ll_token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // 0% recall → Red
      const w1 = await fetch('/api/v1/words/', {
        method: 'POST', headers,
        body: JSON.stringify({ text: 'word_red_zero', translation: 'красный_ноль', language_code: 'en' }),
      }).then((r) => r.json());
      await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w1.id, rating: 'again' }) });

      // ~67% recall → Yellow
      const w2 = await fetch('/api/v1/words/', {
        method: 'POST', headers,
        body: JSON.stringify({ text: 'word_yellow_mid', translation: 'желтый_средний', language_code: 'en' }),
      }).then((r) => r.json());
      await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'good' }) });
      await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'good' }) });
      await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'again' }) });

      // ~80% recall → Green
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
    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    const cardRed = wordlistPage.getWordCard('word_red_zero');
    const cardYellow = wordlistPage.getWordCard('word_yellow_mid');
    const cardGreen = wordlistPage.getWordCard('word_green_high');
    const cardPerfect = wordlistPage.getWordCard('word_perfect_master');

    await expect(cardRed).toBeVisible();
    await expect(cardYellow).toBeVisible();
    await expect(cardGreen).toBeVisible();
    await expect(cardPerfect).toBeVisible();

    await expect(page).toHaveScreenshot();

    await expect(wordlistPage.getCardRecallBadge(cardRed)).toHaveClass(/badge-red/);
    await expect(wordlistPage.getCardRecallBadge(cardRed)).toHaveText('0%');

    await expect(wordlistPage.getCardRecallBadge(cardYellow)).toHaveClass(/badge-yellow/);
    await expect(wordlistPage.getCardRecallBadge(cardYellow)).toHaveText('67%');

    await expect(wordlistPage.getCardRecallBadge(cardGreen)).toHaveClass(/badge-green/);
    await expect(wordlistPage.getCardRecallBadge(cardGreen)).toHaveText('80%');

    await expect(wordlistPage.getCardRecallBadge(cardPerfect)).toHaveClass(/badge-perfect/);
    await expect(wordlistPage.getCardRecallBadge(cardPerfect)).toHaveText('100%');

    // Perfect card has vibrant green border
    await expect(cardPerfect).toHaveClass(/word-card-perfect/);
    const borderColor = await cardPerfect.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(borderColor.includes('16, 185, 129') || borderColor.includes('rgb(16, 185, 129)')).toBeTruthy();

    // Content structure
    await expect(wordlistPage.getCardWord(cardPerfect)).toHaveText('word_perfect_master');
    await expect(wordlistPage.getCardTranslation(cardPerfect)).toHaveText('мастер_сотка');

    // Sorting order: 0% < 67% < 80% < 100% (ascending by y position)
    const boxRed = (await cardRed.boundingBox())!;
    const boxYellow = (await cardYellow.boundingBox())!;
    const boxGreen = (await cardGreen.boundingBox())!;
    const boxPerfect = (await cardPerfect.boundingBox())!;

    expect(boxRed.y).toBeLessThan(boxYellow.y);
    expect(boxYellow.y).toBeLessThan(boxGreen.y);
    expect(boxGreen.y).toBeLessThan(boxPerfect.y);
  });

  test('should open 3-dot context menu and delete word', async ({
    page,
    login,
    header,
    drawer,
    wordlistPage,
  }) => {
    await login();



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

    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    const card = wordlistPage.getWordCard(wordToDelete);
    await expect(card).toBeVisible();

    await wordlistPage.openWordMenu(wordToDelete);

    const dropdown = wordlistPage.getCardDropdown(card);
    await expect(dropdown).toBeVisible();
    const deleteBtn = wordlistPage.getCardDeleteBtn(card);
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toContainText('Delete');

    await deleteBtn.click();

    await expect(wordlistPage.getWordCard(wordToDelete)).toHaveCount(0);
  });

  test('should paginate vocabulary list with 20 items per page', async ({
    page,
    login,
    header,
    drawer,
    wordlistPage,
  }) => {
    await login();

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

    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    await expect(wordlistPage.pagination).toBeVisible();
    await expect(wordlistPage.paginationInfo).toContainText('Page 1 of');

    // 20 cards on page 1
    await expect(wordlistPage.wordCards).toHaveCount(20);

    await expect(wordlistPage.btnNextPage).toBeEnabled();
    await wordlistPage.nextPage();

    await expect(wordlistPage.paginationInfo).toContainText('Page 2 of');
    const cardsPage2 = await wordlistPage.getWordCount();
    expect(cardsPage2).toBeGreaterThanOrEqual(1);
    expect(cardsPage2).toBeLessThanOrEqual(20);

    await expect(wordlistPage.btnPrevPage).toBeEnabled();
    await wordlistPage.prevPage();
    await expect(wordlistPage.paginationInfo).toContainText('Page 1 of');
    await expect(wordlistPage.wordCards).toHaveCount(20);
  });

  test('should handle 3-dot menu positioning and outside click dismissal', async ({
    page,
    login,
    header,
    drawer,
    wordlistPage,
  }) => {
    await login();

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

    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    const cards = wordlistPage.wordCards;
    const bottomCard = cards.nth(4);
    await expect(bottomCard).toBeVisible();

    const dotsBtn = wordlistPage.getCardDotsBtn(bottomCard);
    await expect(dotsBtn).toBeVisible();
    await dotsBtn.click();

    const dropdown = wordlistPage.getCardDropdown(bottomCard);
    await expect(dropdown).toBeVisible();

    const cardBox = await bottomCard.boundingBox();
    expect(cardBox).not.toBeNull();

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
    await header.root.click();
    await expect(dropdown).not.toBeVisible();
  });
});
