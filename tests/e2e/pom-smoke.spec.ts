import { test, expect } from './fixtures';

test.describe('Page Object Models Smoke Verification (Using Fixtures)', () => {
  test('AuthPage handles tab switching and validation', async ({ authPage }) => {
    await authPage.expectLoaded();

    await authPage.switchTab('register');
    await expect(authPage.inputRegUsername).toBeVisible();

    await authPage.switchTab('login');
    await expect(authPage.inputLoginIdentifier).toBeVisible();
  });

  test('LessonsPage and BurgerMenuDrawer navigation', async ({
    login,
    lessonsPage,
    wordlistPage,
    flashcardsPage,
  }) => {
    await login();

    await lessonsPage.expectLoaded();
    await lessonsPage.header.expectAuthenticated();

    // Open drawer and navigate to Wordlist
    await lessonsPage.header.openBurgerMenu();
    await lessonsPage.drawer.expectOpen();
    await lessonsPage.drawer.navigateTo('wordlist');

    await wordlistPage.expectLoaded();

    // Open drawer and navigate to Flashcards
    await wordlistPage.header.openBurgerMenu();
    await wordlistPage.drawer.expectOpen();
    await wordlistPage.drawer.navigateTo('flashcards');

    await flashcardsPage.expectLoaded();

    // Use Brand link in header to return to Lessons
    await flashcardsPage.header.clickBrand();
    await lessonsPage.expectLoaded();
  });

  test('SettingsPage and Logout flow', async ({
    login,
    lessonsPage,
    settingsPage,
    authPage,
    workerUser,
  }) => {
    await login();

    await lessonsPage.expectLoaded();

    // Direct navigation to Settings via header icon
    await lessonsPage.header.openSettings();

    await settingsPage.expectLoaded();
    await settingsPage.expectUsername(workerUser.username);

    // Logout
    await settingsPage.logout();

    await authPage.expectLoaded();
  });
});
