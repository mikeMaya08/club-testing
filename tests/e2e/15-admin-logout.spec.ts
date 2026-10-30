import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 15 — Admin logs out and lands on the login screen
 *
 * The header shows the current user; "Log out" clears the session and
 * redirects to /login, where the user can log in again from the account list.
 */
test('admin logs out, returns to login and can log back in', async ({ page }) => {
  const admin = new AdminPage(page)

  await page.goto(adminUrl('', { seed: 'demo', reset: true }))
  await expect(page.getByTestId('current-user')).toBeVisible()

  await admin.logout()

  // Login screen lists accounts; the admin account is selectable again
  await expect(page.getByTestId('login-user-admin-1')).toBeVisible()

  await admin.loginAs('admin-1')
  await expect(page.getByTestId('current-user')).toBeVisible()
})
