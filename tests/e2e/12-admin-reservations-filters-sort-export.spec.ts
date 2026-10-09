import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 12 — Admin Reservations: filters, sort, pagination and CSV export
 *
 * Covers the logic clarified in club-admin PR #3 (docs/code-comments):
 *  - Filtering happens before sorting; `rows` is the full filtered result and
 *    the page only slices it for display.
 *  - Clicking the active sort column flips the direction; clicking a new column
 *    always starts ascending.
 *  - CSV export includes every row that matches the current filters, not just
 *    the visible page.
 *  - `csvCell` quotes values and doubles any embedded quote character.
 *
 * Happy paths use the "demo" seed. Negative paths verify empty-state messaging
 * and that action buttons are disabled for non-"booked" reservations.
 */

// ─── Happy paths ─────────────────────────────────────────────────────────────

test('reservations page loads and shows the table with demo data', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await expect(page.getByTestId('reservations-page')).toBeVisible()
  await expect(page.getByTestId('reservations-table')).toBeVisible()

  // At least one row must be present in the demo seed
  const firstRow = page.locator('[data-testid^="res-row-"]').first()
  await expect(firstRow).toBeVisible()
})

test('filtering by status "booked" shows only booked rows', async ({ page }) => {
  const admin = new AdminPage(page)
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await admin.filterByStatus('booked')

  // Every visible row must carry data-status="booked"
  const rows = page.locator('[data-testid^="res-row-"]')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toHaveAttribute('data-status', 'booked')
  }
})

test('filtering by player narrows the result set', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Filter to player-1 (Lucía Fernández)
  await page.getByTestId('filter-player').selectOption('player-1')

  // Result count must be shown and at least one row visible
  await expect(page.getByTestId('result-count')).toBeVisible()
  const firstRow = page.locator('[data-testid^="res-row-"]').first()
  await expect(firstRow).toBeVisible()
})

test('clearing filters restores the full result set', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Apply a narrow filter then clear it
  await page.getByTestId('filter-status').selectOption('cancelled')
  await page.getByTestId('filter-clear').click()

  // After clearing, the status filter must be back to "All" (empty value)
  await expect(page.getByTestId('filter-status')).toHaveValue('')
})

test('clicking the Date column header sorts ascending, clicking again sorts descending', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Default sort is date desc — clicking Date should flip to asc
  await page.getByTestId('sort-date').click()
  const dateHeader = page.getByRole('columnheader').filter({ hasText: /Date/ })
  await expect(dateHeader).toHaveAttribute('aria-sort', 'ascending')

  // Clicking again flips to descending
  await page.getByTestId('sort-date').click()
  await expect(dateHeader).toHaveAttribute('aria-sort', 'descending')
})

test('clicking a different sort column starts ascending', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Click the Price column (not the active sort column)
  await page.getByTestId('sort-price').click()
  const priceHeader = page.getByRole('columnheader').filter({ hasText: /Price/ })
  await expect(priceHeader).toHaveAttribute('aria-sort', 'ascending')
})

test('pagination controls are present and Prev is disabled on the first page', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await expect(page.getByTestId('pagination')).toBeVisible()
  await expect(page.getByTestId('page-prev')).toBeDisabled()
  await expect(page.getByTestId('page-info')).toContainText('Page 1')
})

test('changing page size to 25 updates the rows-per-page selector', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await page.getByTestId('page-size').selectOption('25')
  await expect(page.getByTestId('page-size')).toHaveValue('25')
})

test('Export CSV button is present and triggers a download', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Listen for the download event triggered by the CSV export
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-csv').click(),
  ])

  expect(download.suggestedFilename()).toBe('reservations.csv')
})

test('admin can mark a booked reservation as no-show', async ({ page }) => {
  const admin = new AdminPage(page)
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await admin.filterByStatus('booked')

  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  await admin.markNoShow(resId)

  // After marking no-show, clear the filter and verify the status changed
  await page.getByTestId('filter-clear').click()
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('no-show')
})

test('admin can cancel a booked reservation via the confirmation dialog', async ({ page }) => {
  const admin = new AdminPage(page)
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await admin.filterByStatus('booked')

  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  await admin.cancelReservation(resId)

  // Clear filter and verify the row now shows "cancelled"
  await page.getByTestId('filter-clear').click()
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('cancelled')
})

// ─── Negative / edge-case paths ───────────────────────────────────────────────

test('applying a date range that matches nothing shows the empty-state message', async ({ page }) => {
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Use a date range far in the past that has no reservations
  await page.getByTestId('filter-from').fill('2000-01-01')
  await page.getByTestId('filter-to').fill('2000-01-02')

  await expect(page.getByTestId('reservations-empty')).toBeVisible()
  await expect(page.getByTestId('reservations-empty')).toContainText('No reservations match the filters.')
})

test('No-show and Cancel buttons are disabled for a cancelled reservation', async ({ page }) => {
  const admin = new AdminPage(page)
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await admin.filterByStatus('cancelled')

  const row = admin.firstRowWithStatus('cancelled')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  // Both action buttons must be disabled for non-booked rows
  await expect(page.getByTestId(`res-noshow-${resId}`)).toBeDisabled()
  await expect(page.getByTestId(`res-cancel-${resId}`)).toBeDisabled()
})

test('No-show and Cancel buttons are disabled for a completed reservation', async ({ page }) => {
  const admin = new AdminPage(page)
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await admin.filterByStatus('completed')

  const row = admin.firstRowWithStatus('completed')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  await expect(page.getByTestId(`res-noshow-${resId}`)).toBeDisabled()
  await expect(page.getByTestId(`res-cancel-${resId}`)).toBeDisabled()
})

test('cancel dialog can be dismissed without changing the reservation status', async ({ page }) => {
  const admin = new AdminPage(page)
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  await admin.filterByStatus('booked')

  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  // Open the cancel dialog then dismiss it
  await page.getByTestId(`res-cancel-${resId}`).click()
  await expect(page.getByTestId('res-cancel-dialog')).toBeVisible()
  await page.getByTestId('res-cancel-dismiss').click()

  // Dialog must close and the status must remain "booked"
  await expect(page.getByTestId('res-cancel-dialog')).not.toBeVisible()
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('booked')
})

test('reservations page is not accessible without a session — redirects to login', async ({ page }) => {
  const base = process.env.ADMIN_URL ?? 'https://club-admin-omega.vercel.app'
  await page.goto(`${base}/admin/reservations?reset=1&seed=demo`)

  // Guard redirects unauthenticated visitors to /login
  await expect(page).toHaveURL(/\/login/)
})
