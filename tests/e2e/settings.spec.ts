import { test, expect } from './fixtures';

test.describe('Settings Page', () => {
  test('should display username and log out user back to auth view', async ({
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
