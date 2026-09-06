/**
 * Global setup – runs once after the webServer is ready, before any tests.
 *
 * The FastAPI server is now managed entirely by Playwright's `webServer` config
 * option, so all we need here is to pre-register the demo_student account.
 * The backend requires `source_language` and `target_language` at registration
 * time, which the Quick Demo Login button doesn't supply when falling back to
 * registration – so we seed the user here instead.
 */
export default async function globalSetup() {
  const baseUrl = `http://127.0.0.1:${process.env.TEST_PORT ?? 8899}`;

  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'demo_student',
      password: 'demopassword123',
      source_language: 'ru',
      target_language: 'en',
    }),
  });

  // 201 = created, 400 = user already exists (idempotent) – both are fine.
  if (!res.ok && res.status !== 400) {
    const body = await res.text();
    throw new Error(`Failed to seed demo user: HTTP ${res.status} – ${body}`);
  }
}
