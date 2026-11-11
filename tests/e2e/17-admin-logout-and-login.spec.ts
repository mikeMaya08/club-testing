import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 17 — Admin logout and login
 *
 * The admin app has a fake login (one button per admin user, no password).
 * Starting from a session created with `?as=admin-1`, logging out must return the user
 * to /login, and picking an admin account must land back inside the app.
 */
test('admin logs out, lands on the login page and can sign back in', async ({ page }) => {
  const admin = new AdminPage(page)

  await page.goto(adminUrl('', { seed: 'demo' }))
  await expect(page.getByTestId('current-user')).toBeVisible()

  // ── Logout → login page ───────────────────────────────────────────────────
  await admin.logout()
  await expect(page.getByTestId('login-title')).toBeVisible()
  await expect(page.getByTestId('login-user-admin-1')).toBeVisible()

  // ── Login again by picking the admin account ──────────────────────────────
  await admin.loginAs('admin-1')
  await expect(page.getByTestId('current-user')).toContainText('Ana Admin')

  // The sidebar is available again
  await admin.goToReservations()
})
