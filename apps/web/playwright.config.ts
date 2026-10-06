import { defineConfig, devices } from '@playwright/test';

// F14.1 — runs against the local stack (pnpm dev:all). Starts it when nothing answers on :5173.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: 'node ../../infra/scripts/dev-all.mjs',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 8 * 60_000,
  },
});
