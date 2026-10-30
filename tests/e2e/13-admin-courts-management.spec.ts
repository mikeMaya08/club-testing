import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 13 — Admin manages courts (add, rename, toggle lights, delete)
 *
 * Covers the admin Courts module. Each test starts from a freshly re-seeded
 * demo state (reset=1 via adminUrl) so tests are independent. The court
 * created here has no reservations, so it can be deleted
 * ("Courts with future reservations cannot be deleted").
 */
test.describe('admin courts management', () => {
  test.beforeEach(async ({ page }) => {
    // Start on the dashboard (logged in as admin-1) and navigate like a user.
    await page.goto(adminUrl('', { seed: 'demo', reset: true }))
    await new AdminPage(page).goToCourts()
  })

  test('admin adds a new court and it appears in the table', async ({ page }) => {
    const admin = new AdminPage(page)

    await admin.addCourt('QA Court', 'hard', false)

    const row = admin.courtRowByName('QA Court')
    await expect(row).toContainText('hard')
    // Lights were unchecked in the form, so the new court has lights off
    await expect(row.getByRole('checkbox', { name: 'Lights for QA Court' })).not.toBeChecked()
    await expect(row.getByRole('checkbox', { name: 'Active for QA Court' })).toBeChecked()
  })

  test('admin renames a court', async ({ page }) => {
    const admin = new AdminPage(page)

    await admin.addCourt('QA Court', 'clay', true)
    await admin.renameCourt('QA Court', 'QA Court Renamed')

    await expect(admin.courtRowByName('QA Court Renamed')).toBeVisible()
    await expect(page.getByTestId('courts-table').getByText('QA Court', { exact: true })).toHaveCount(0)
  })

  test('admin toggles lights and active status on a court', async ({ page }) => {
    const admin = new AdminPage(page)

    await admin.addCourt('QA Court', 'clay', true)
    const row = admin.courtRowByName('QA Court')
    const lights = row.getByRole('checkbox', { name: 'Lights for QA Court' })
    const active = row.getByRole('checkbox', { name: 'Active for QA Court' })

    await expect(lights).toBeChecked()
    await lights.uncheck()
    await expect(lights).not.toBeChecked()

    await expect(active).toBeChecked()
    await active.uncheck()
    await expect(active).not.toBeChecked()
  })

  test('admin deletes a court without reservations', async ({ page }) => {
    const admin = new AdminPage(page)

    await admin.addCourt('QA Court', 'clay', true)
    await admin.deleteCourt('QA Court')

    await expect(admin.courtRowByName('QA Court')).toHaveCount(0)
  })

  test('keeping a court in the delete dialog leaves it in the table', async ({ page }) => {
    const admin = new AdminPage(page)

    await admin.addCourt('QA Court', 'clay', true)
    await admin.courtRowByName('QA Court').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('court-delete-dialog')).toBeVisible()

    await page.getByTestId('court-delete-cancel').click()

    await expect(page.getByTestId('court-delete-dialog')).not.toBeVisible()
    await expect(admin.courtRowByName('QA Court')).toBeVisible()
  })
})
