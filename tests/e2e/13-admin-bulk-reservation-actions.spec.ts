import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 13 — Admin bulk actions in Reservations (club-admin PR #7)
 *
 * Covers: row/header selection, bulk bar counter, clear selection,
 * bulk cancel with confirmation, bulk no-show, and disabled checkboxes
 * for non-booked rows.
 *
 * Requires the club-admin deployment to include the bulk-actions feature.
 */
test.describe('Admin bulk reservation actions', () => {
  let admin: AdminPage

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page)
    // Demo seed, logged in as admin-1 via ?as=; show only booked reservations
    await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))
    await admin.filterByStatus('booked')
    await expect(admin.firstRowWithStatus('booked')).toBeVisible()
  })

  test('header checkbox selects every booked row on the page and shows the count', async () => {
    const ids = await admin.visibleBookedIds()
    expect(ids.length).toBeGreaterThan(0)

    await admin.selectPageCheckbox.check()

    // Fails if the header checkbox does not select all booked rows of the page
    for (const id of ids) {
      await expect(admin.rowCheckbox(id)).toBeChecked()
    }
    await expect(admin.bulkBar).toBeVisible()
    await expect(admin.bulkCount).toHaveText(`${ids.length} selected`)
  })

  test('clear selection unchecks the rows and hides the bulk bar', async ({ page }) => {
    const [firstId] = await admin.visibleBookedIds()

    await admin.rowCheckbox(firstId).check()
    await expect(admin.bulkCount).toHaveText('1 selected')

    await page.getByTestId('bulk-clear').click()

    await expect(admin.bulkBar).toBeHidden()
    await expect(admin.rowCheckbox(firstId)).not.toBeChecked()
  })

  test('bulk cancel asks for confirmation and cancels the selected reservations', async ({ page }) => {
    const ids = (await admin.visibleBookedIds()).slice(0, 2)
    expect(ids.length).toBeGreaterThan(0)

    for (const id of ids) await admin.rowCheckbox(id).check()
    await expect(admin.bulkCount).toHaveText(`${ids.length} selected`)

    // Confirmation dialog appears first; "Keep" must not cancel anything
    await page.getByTestId('bulk-cancel').click()
    await expect(page.getByTestId('bulk-cancel-dialog')).toBeVisible()
    await page.getByTestId('bulk-cancel-dismiss').click()
    await expect(page.getByTestId('bulk-cancel-dialog')).toBeHidden()
    await expect(page.getByTestId('bulk-result')).toBeHidden()

    // Confirm for real
    await admin.bulkCancelSelected()

    await expect(admin.bulkResultSummary).toHaveText(`Cancelled ${ids.length} of ${ids.length} reservation${ids.length === 1 ? '' : 's'}.`)
    await expect(page.getByTestId('bulk-result-failures')).toBeHidden()

    // Rows are no longer booked; clear the filter to see their new status
    await page.getByTestId('filter-clear').click()
    for (const id of ids) {
      await expect(page.getByTestId(`res-status-${id}`)).toHaveText('cancelled')
    }
    await expect(admin.bulkBar).toBeHidden()
  })

  test('bulk mark no-show updates the selected reservations', async ({ page }) => {
    const ids = (await admin.visibleBookedIds()).slice(0, 2)
    expect(ids.length).toBeGreaterThan(0)

    for (const id of ids) await admin.rowCheckbox(id).check()
    await admin.bulkMarkNoShow()

    await expect(admin.bulkResultSummary).toHaveText(
      `Marked as no-show ${ids.length} of ${ids.length} reservation${ids.length === 1 ? '' : 's'}.`,
    )

    await page.getByTestId('filter-clear').click()
    for (const id of ids) {
      await expect(page.getByTestId(`res-status-${id}`)).toHaveText('no-show')
    }
  })

  test('checkboxes of non-booked rows are disabled', async ({ page }) => {
    await admin.filterByStatus('cancelled')
    const row = admin.firstRowWithStatus('cancelled')
    await expect(row).toBeVisible()
    const id = await admin.resIdFromRow(row)

    // Fails if non-booked reservations become selectable
    await expect(admin.rowCheckbox(id)).toBeDisabled()
    await expect(admin.selectPageCheckbox).toBeDisabled()
  })
})
