import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 13 — Admin manages courts
 *
 * Covers the Courts page: create, rename, toggle lights/active, delete, and the
 * COURT_IN_USE rule that blocks deleting a court with upcoming reservations/lessons.
 *
 * Seeds (club-store):
 *  - `empty`: 6 courts, no reservations/lessons → any court can be deleted.
 *  - `demo`:  court-1 hosts lesson-1 on the day after the (frozen) club clock → in use.
 *    court-4 is inactive and court-5 has no lights.
 */
test.describe('Admin · Courts management', () => {
  let admin: AdminPage

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page)
  })

  /** Open the admin app on the Dashboard and navigate to Courts through the sidebar. */
  async function openCourts(page: import('@playwright/test').Page, seed: 'empty' | 'demo') {
    await page.goto(adminUrl('', { seed }))
    await admin.goToCourts()
  }

  test('creates a court and shows it in the table with the chosen surface and lights', async ({ page }) => {
    await openCourts(page, 'empty')

    await admin.addCourt('Court 7', 'hard', false)

    await expect(admin.toast('Court created')).toBeVisible()
    const row = admin.courtRowByName('Court 7')
    await expect(row).toBeVisible()
    await expect(row).toContainText('hard')
    await expect(row.getByRole('checkbox', { name: 'Lights for Court 7' })).not.toBeChecked()
    await expect(row.getByRole('checkbox', { name: 'Active for Court 7' })).toBeChecked()
    // The form is cleared after a successful creation
    await expect(page.getByTestId('court-name-input')).toHaveValue('')
  })

  test('"Add court" stays disabled while the name is blank', async ({ page }) => {
    await openCourts(page, 'empty')

    await expect(page.getByTestId('court-add')).toBeDisabled()
    await page.getByTestId('court-name-input').fill('   ')
    await expect(page.getByTestId('court-add')).toBeDisabled()
    await page.getByTestId('court-name-input').fill('Court 8')
    await expect(page.getByTestId('court-add')).toBeEnabled()
  })

  test('renames a court and blocks saving an empty name', async ({ page }) => {
    await openCourts(page, 'empty')

    await page.getByTestId('court-edit-court-1').click()
    await page.getByTestId('court-edit-input').fill('')
    await expect(page.getByTestId('court-edit-save')).toBeDisabled()

    await page.getByTestId('court-edit-input').fill('Center Court')
    await page.getByTestId('court-edit-save').click()

    await expect(admin.toast('Court renamed')).toBeVisible()
    await expect(page.getByTestId('court-name-court-1')).toHaveText('Center Court')
    await expect(page.getByTestId('court-edit-dialog')).toBeHidden()
  })

  test('toggling lights and active persists after leaving and returning to Courts', async ({ page }) => {
    await openCourts(page, 'demo')

    // court-5 has no lights, court-4 is inactive in the demo seed
    await expect(page.getByTestId('court-lights-court-5')).not.toBeChecked()
    await expect(page.getByTestId('court-active-court-4')).not.toBeChecked()

    await page.getByTestId('court-lights-court-5').check()
    await page.getByTestId('court-active-court-4').check()
    await expect(page.getByTestId('court-lights-court-5')).toBeChecked()
    await expect(page.getByTestId('court-active-court-4')).toBeChecked()

    // Leave the page and come back (user-like navigation) — state must persist
    await admin.goToUsers()
    await admin.goToCourts()
    await expect(page.getByTestId('court-lights-court-5')).toBeChecked()
    await expect(page.getByTestId('court-active-court-4')).toBeChecked()
  })

  test('deletes a court that has no upcoming reservations or lessons', async ({ page }) => {
    await openCourts(page, 'empty')

    await admin.deleteCourt('court-6')

    await expect(admin.toast('Court deleted')).toBeVisible()
    await expect(page.getByTestId('court-row-court-6')).toHaveCount(0)
    await expect(page.getByTestId('court-row-court-5')).toBeVisible()
  })

  test('"Keep" in the delete dialog leaves the court untouched', async ({ page }) => {
    await openCourts(page, 'empty')

    await page.getByTestId('court-delete-court-6').click()
    await expect(page.getByTestId('court-delete-dialog')).toBeVisible()
    await page.getByTestId('court-delete-cancel').click()

    await expect(page.getByTestId('court-delete-dialog')).toBeHidden()
    await expect(page.getByTestId('court-row-court-6')).toBeVisible()
  })

  test('deleting a court with upcoming usage is rejected (COURT_IN_USE)', async ({ page }) => {
    await openCourts(page, 'demo')

    // court-1 hosts an upcoming lesson in the demo seed
    await admin.deleteCourt('court-1')

    const errorToast = admin.toast('This court still has upcoming reservations or lessons.')
    await expect(errorToast).toBeVisible()
    await expect(errorToast).toHaveAttribute('data-kind', 'error')
    await expect(page.getByTestId('court-row-court-1')).toBeVisible()
  })
})
