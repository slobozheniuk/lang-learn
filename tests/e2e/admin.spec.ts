import { test, expect } from './fixtures';

test.describe('Admin Dashboard & Journey Logs', () => {
  test('regular user does not see admin navigation link in drawer', async ({
    login,
    header,
    drawer,
  }) => {
    await login();
    await header.openMenu();
    await drawer.expectOpen();

    // Regular users must not see the admin link
    await expect(drawer.navAdmin).toBeHidden();
    await drawer.close();
  });

  test('admin user can log in with .env credentials and navigate to admin view', async ({
    authPage,
    header,
    drawer,
    lessonsPage,
    adminPage,
  }) => {
    await authPage.expectLoaded();
    // Admin login with .env credentials
    await authPage.login('admin', 'admin123');

    await lessonsPage.expectLoaded();
    await header.openMenu();
    await drawer.expectOpen();

    // Admin link should be visible in drawer
    await expect(drawer.navAdmin).toBeVisible();

    // Navigate to Admin page
    await drawer.navigateToAdmin();
    await adminPage.expectLoaded();
    await expect(adminPage.tabUsers).toBeVisible();
    await expect(adminPage.tabLogs).toBeVisible();
  });

  test('admin users tab displays metrics and registered user list with statistics', async ({
    authPage,
    header,
    drawer,
    adminPage,
  }) => {
    await authPage.expectLoaded();
    await authPage.login('admin', 'admin123');

    await header.openMenu();
    await drawer.navigateToAdmin();
    await adminPage.expectLoaded();

    await adminPage.switchToUsersTab();

    // Assert metric cards
    await expect(adminPage.statTotalUsers).toBeVisible();
    await expect(adminPage.statTotalLessons).toBeVisible();
    await expect(adminPage.statTotalWords).toBeVisible();

    // Assert user cards list is populated
    await expect(adminPage.userCards.first()).toBeVisible();
    const userNames = await adminPage.root.locator('.admin-user-name').allInnerTexts();
    expect(userNames.some((name) => name.includes('admin'))).toBe(true);
  });

  test('admin log journeys tab displays interactive buttons and opens separate journey detail with back button', async ({
    page,
    authPage,
    header,
    drawer,
    adminPage,
  }) => {
    // 1. Seed a completed journey via API to ensure a journey is in logs
    const seedRes = await page.evaluate(async () => {
      const loginRes = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: 'admin', password: 'admin123' }),
      });
      const loginData = await loginRes.json();
      const token = loginData.access_token;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // Submit text eligible for lesson (> 4 words)
      const subRes = await fetch('/api/v1/words/submit-text', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: 'The clever dog barked at the lazy fox.',
          source_lang: 'ru',
          target_lang: 'en',
        }),
      });
      const subData = await subRes.json();
      const lessonId = subData.lesson?.id;

      if (lessonId) {
        // Submit chunks selection (Continue)
        await fetch(`/api/v1/lessons/${lessonId}/prepare`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            selected_words: ['barked', 'lazy'],
            source_lang: 'ru',
            target_lang: 'en',
          }),
        });
      }
      return { lessonId };
    });

    expect(seedRes.lessonId).toBeTruthy();

    // 2. Log in as admin and navigate to Admin View
    await authPage.expectLoaded();
    await authPage.login('admin', 'admin123');

    await header.openMenu();
    await drawer.navigateToAdmin();
    await adminPage.expectLoaded();

    // 3. Switch to Journey Logs tab
    await adminPage.switchToLogsTab();
    await adminPage.refreshLogs();

    // 4. Verify journeys list renders interactive buttons
    await expect(adminPage.journeyButtons.first()).toBeVisible({ timeout: 10000 });
    const journeyCount = await adminPage.journeyButtons.count();
    expect(journeyCount).toBeGreaterThan(0);

    // 5. Click the journey button to open the separate Journey Detail view
    await adminPage.openJourney(0);

    // 6. Verify Journey Detail View
    await expect(adminPage.journeyDetailView).toBeVisible();
    await expect(adminPage.btnBackToJourneys).toBeVisible();
    await expect(adminPage.journeyDetailUser).toBeVisible();

    // Verify chosen chunks
    await expect(adminPage.journeyDetailChosenChunksSection).toBeVisible();
    const chunks = await adminPage.getChosenChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.includes('barked') || c.includes('lazy'))).toBe(true);

    // Verify progress of actions
    const stepNames = await adminPage.getActionStepNames();
    expect(stepNames.length).toBeGreaterThan(0);

    // Verify LLM interactions with prompt and output
    const interaction = await adminPage.getFirstLLMInteraction();
    expect(interaction.prompt.length).toBeGreaterThan(0);
    expect(interaction.output.length).toBeGreaterThan(0);

    // 7. Click Back button to return to journeys list
    await adminPage.backToJourneys();
    await expect(adminPage.journeyButtons.first()).toBeVisible();
  });
});
