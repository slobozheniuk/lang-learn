import { defineConfig, devices } from '@playwright/test';

const TEST_PORT = 8899; // separate from the normal dev server port (8888)
// Unique DB per run so the state is always clean even when reusing an existing server.
const TEST_DB = `/tmp/lang-learn-e2e-${Date.now()}.db`;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/fixtures.ts'],
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',

  // ---------------------------------------------------------------------------
  // Web server – Playwright starts the FastAPI server before tests and kills it
  // afterwards. No manual process management needed.
  // ---------------------------------------------------------------------------
  webServer: {
    command: `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port ${TEST_PORT} --log-level warning`,
    url: `http://127.0.0.1:${TEST_PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DATABASE_URL: `sqlite:///${TEST_DB}`,
      PYTHONPATH: '.',
      NOUS_API_KEY: '',
      OPENAI_API_KEY: '',
      LLM_API_KEY: '',
    },
  },

  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'Mobile Chrome – Galaxy S24',
      use: { ...devices['Galaxy S24'] },
    },
    {
      name: 'Mobile Safari – iPhone 13 Pro Max',
      use: { ...devices['iPhone 13 Pro Max'] },
    },
  ],
});
