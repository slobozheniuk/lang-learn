import { test, expect } from './fixtures';

test.describe('Settings Page', () => {
  test('should render settings page layout', async ({
    page,
    login,
    lessonsPage,
    settingsPage,
    workerUser,
  }) => {
    await login();
    await lessonsPage.expectLoaded();
    await lessonsPage.header.openSettings();
    await settingsPage.expectLoaded();
    await settingsPage.expectUsername(workerUser.username);

    await expect(page).toHaveScreenshot({ mask: [settingsPage.userName] });
  });

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
