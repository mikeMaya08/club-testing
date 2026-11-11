import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 15 — Admin Users page: role change, reactivation, confirm-dialog cancel, self-protection
 *
 * Complements E2E 03 (deactivation cascade). Uses the `demo` seed, logged in as admin-1.
 */
test.describe('Admin · Users', () => {
  let admin: AdminPage

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page)
    await page.goto(adminUrl('', { seed: 'demo' }))
    await admin.goToUsers()
  })

  test('changes a user role and keeps it after navigating away and back', async ({ page }) => {
    await expect(page.getByTestId('user-role-player-5')).toHaveValue('player')

    await admin.setUserRole('player-5', 'coach')

    await expect(admin.toast('Role updated')).toBeVisible()
    await expect(page.getByTestId('user-role-player-5')).toHaveValue('coach')

    await admin.goToSettings()
    await admin.goToUsers()
    await expect(page.getByTestId('user-role-player-5')).toHaveValue('coach')
  })

  test('deactivating then reactivating a user restores their Active status', async ({ page }) => {
    await admin.setUserActive('player-2', false)
    await expect(admin.toast('User deactivated')).toBeVisible()
    await expect(page.getByTestId('user-status-player-2')).toHaveText('Inactive')

    // The reactivate dialog uses different wording than the deactivate one
    await page.getByTestId('user-active-player-2').click()
    await expect(page.getByTestId('user-confirm-text')).toContainText('will be able to use the club again.')
    await page.getByTestId('user-confirm-ok').click()

    await expect(admin.toast('User reactivated')).toBeVisible()
    await expect(page.getByTestId('user-status-player-2')).toHaveText('Active')
    await expect(page.getByTestId('user-row-player-2')).toHaveAttribute('data-active', 'true')
  })

  test('cancelling the deactivate dialog keeps the user active', async ({ page }) => {
    await page.getByTestId('user-active-player-3').click()
    await expect(page.getByTestId('user-confirm-text')).toContainText(
      'will be logged out and all their future reservations will be cancelled.',
    )
    await page.getByTestId('user-confirm-cancel').click()

    await expect(page.getByTestId('user-confirm-dialog')).toBeHidden()
    await expect(page.getByTestId('user-status-player-3')).toHaveText('Active')
  })

  test('an admin cannot change their own role or deactivate themselves', async ({ page }) => {
    await expect(page.getByTestId('user-role-admin-1')).toBeDisabled()
    await expect(page.getByTestId('user-role-admin-1')).toHaveAttribute('title', "You can't change your own role")
    await expect(page.getByTestId('user-active-admin-1')).toBeDisabled()
    await expect(page.getByTestId('user-active-admin-1')).toHaveAttribute('title', "You can't deactivate yourself")

    // Other users remain editable
    await expect(page.getByTestId('user-role-player-1')).toBeEnabled()
    await expect(page.getByTestId('user-active-player-1')).toBeEnabled()
  })
})
