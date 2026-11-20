import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
/** Unroutable on purpose — every oracle call is served by `page.route` in `e2e/fixtures/mock-oracle.ts`, never a live backend. */
export const MOCK_ORACLE_URL = 'http://oracle.mock';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev --turbopack --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_PUBLIC_ORACLE_URL: MOCK_ORACLE_URL },
  },
});
