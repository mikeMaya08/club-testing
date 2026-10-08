import { defineConfig, devices } from '@playwright/test'

/**
 * All apps are served by the shell on the same origin so they can share
 * localStorage. The shell proxies:
 *   /admin  → club-admin   (port 5001)
 *   /coach  → club-coach   (port 5002)
 *   /player → club-player  (port 5003)
 *
 * Set SHELL_URL in your environment to override (e.g. for a deployed preview).
 */
const SHELL_URL = process.env.SHELL_URL ?? 'http://127.0.0.1:5000'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // tests share localStorage state via the shell
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['@muuktest/amikoo-reporter'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: SHELL_URL,
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
