import { defineConfig, devices } from '@playwright/test'

/**
 * Each sub-app is deployed independently on Vercel.
 * Tests navigate to absolute URLs — see tests/helpers/urls.ts.
 * URLs come from environment variables (configured in Amikoo, or a local
 * .env that is NOT committed). The run fails fast if one is missing.
 *
 * Note: ADMIN_URL, COACH_URL and PLAYER_URL are consumed by
 * tests/helpers/urls.ts (with safe fallback defaults). They must NOT be
 * validated here at config-load time, because Playwright loads this file
 * before any env vars from the executor are injected.
 */

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['@muuktest/amikoo-reporter'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
