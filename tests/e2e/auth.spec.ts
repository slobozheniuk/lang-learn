import { test, expect } from './fixtures';

test.describe('Authentication Page', () => {
  test('should toggle between Login and Register tabs and complete sign-in / sign-out flow', async ({
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

  test('should handle tab switching between register and login forms', async ({ authPage }) => {
    await authPage.expectLoaded();

    await authPage.switchTab('register');
    await expect(authPage.inputRegUsername).toBeVisible();

    await authPage.switchTab('login');
    await expect(authPage.inputLoginIdentifier).toBeVisible();
  });
});
