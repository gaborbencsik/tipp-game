import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  retries: 1,
  // Specs share a single global test user and mutate its groups, so cross-file
  // parallel runs race (e.g. tournament-tips no-access vs bracket-progression
  // setup creating a WC group). Serialize at the worker level.
  workers: 1,
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
