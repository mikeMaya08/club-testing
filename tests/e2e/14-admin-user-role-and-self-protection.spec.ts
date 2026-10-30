import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 14 — Admin Users module: role selector and self-protection
 *
 * The Users table lets an admin change another user's role, but the logged-in
 * admin's own role selector and active switch are disabled
 * ("You can't change your own role" / "You can't deactivate yourself").
 * Seed users used: admin-1 (logged in via adminUrl default) and player-3
 * (also used by existing tests).
 */
test.describe('admin users: roles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(adminUrl('', { seed: 'demo', reset: true }))
    await new AdminPage(page).goToUsers()
  })

  test('admin changes another user\'s role', async ({ page }) => {
    const admin = new AdminPage(page)
    const roleSelect = page.getByTestId('user-role-player-3')

    await expect(roleSelect).toHaveValue('player')
    await admin.setUserRole('player-3', 'coach')

    await expect(roleSelect).toHaveValue('coach')
  })

  test('admin cannot change their own role or deactivate themselves', async ({ page }) => {
    await expect(page.getByTestId('user-role-admin-1')).toBeDisabled()
    await expect(page.getByTestId('user-active-admin-1')).toBeDisabled()
  })

  test('cancelling the deactivate dialog keeps the user active', async ({ page }) => {
    await page.getByTestId('user-active-player-3').click()
    await expect(page.getByTestId('user-confirm-dialog')).toBeVisible()

    await page.getByTestId('user-confirm-cancel').click()

    await expect(page.getByTestId('user-confirm-dialog')).not.toBeVisible()
    await expect(page.getByTestId('user-status-player-3')).toHaveText('Active')
  })
})
