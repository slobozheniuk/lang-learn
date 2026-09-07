import { test, expect } from './fixtures';

test.describe('Global Navigation & Drawer', () => {
  test('should open burger drawer menu, show nav links, and close via backdrop', async ({
    login,
    header,
    drawer,
  }) => {
    await login();

    await expect(header.btnBurger).toBeVisible();
    expect(await header.btnBurger.innerText()).toContain('☰');

    // Open drawer
    await header.openBurgerMenu();
    await drawer.expectOpen();
    await expect(drawer.backdrop).toHaveClass(/(is-open|open|active|show)/);

    // No 'Menu' text in drawer header
    await expect(drawer.drawerHeader).not.toContainText('Menu');

    // Nav links exist
    await expect(drawer.navLessons).toBeVisible();
    await expect(drawer.navFlashcards).toBeVisible();
    await expect(drawer.navWordlist).toBeVisible();

    // Close via backdrop click (right of 270px drawer on 390px viewport)
    await drawer.closeViaBackdrop({ x: 330, y: 200 });
    await drawer.expectClosed();
  });

  test('should navigate between Lessons, Wordlist, and Flashcards, and return home via brand logo', async ({
    login,
    header,
    drawer,
    lessonsPage,
    flashcardsPage,
    wordlistPage,
  }) => {
    await login();

    // No page title badge in header
    await expect(header.pageTitle).toHaveCount(0);

    // Initial page is Lessons
    await lessonsPage.expectLoaded();

    // Navigate to Wordlist
    await header.openBurgerMenu();
    await drawer.navigateTo('wordlist');
    await wordlistPage.expectLoaded();

    // Navigate to Flashcards
    await header.openBurgerMenu();
    await drawer.navigateTo('flashcards');
    await flashcardsPage.expectLoaded();

    // Navigate back to Lessons via brand logo
    await header.clickBrand();
    await lessonsPage.expectLoaded();
  });

  test('should close drawer when clicking close button or pressing Escape', async ({
    login,
    header,
    drawer,
  }) => {
    await login();

    // Open and close via button
    await header.openBurgerMenu();
    await drawer.expectOpen();
    await drawer.close();
    await drawer.expectClosed();

    // Open and close via Escape
    await header.openBurgerMenu();
    await drawer.expectOpen();
    await drawer.closeViaEscape();
    await drawer.expectClosed();
  });
});
