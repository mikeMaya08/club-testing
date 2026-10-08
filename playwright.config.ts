import { defineConfig, devices } from '@playwright/test'

/**
 * Each sub-app is deployed independently on Vercel.
 * Tests navigate to absolute URLs — see tests/helpers/urls.ts.
 * Override any of these via environment variables for preview deployments.
 */
export const ADMIN_URL  = process.env.ADMIN_URL  ?? 'https://club-admin-omega.vercel.app'
export const COACH_URL  = process.env.COACH_URL  ?? 'https://club-coach-ten.vercel.app'
export const PLAYER_URL = process.env.PLAYER_URL ?? 'https://club-player.vercel.app'

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['@muuktest/amikoo-reporter'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
