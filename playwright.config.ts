import { defineConfig, devices } from '@playwright/test'

/**
 * Each sub-app is deployed independently on Vercel.
 * Tests navigate to absolute URLs — see tests/helpers/urls.ts.
 * URLs come from environment variables (configured in Amikoo, or a local
 * .env that is NOT committed). The run fails fast if one is missing.
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const ADMIN_URL  = requireEnv('ADMIN_URL')
export const COACH_URL  = requireEnv('COACH_URL')
export const PLAYER_URL = requireEnv('PLAYER_URL')

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
