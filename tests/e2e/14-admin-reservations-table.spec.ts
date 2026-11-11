import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 14 — Admin reservations list: filters, sorting, pagination, CSV export, no-show
 *
 * Uses the deterministic `demo` seed with the frozen club clock (FIXED_NOW = 2026-10-10),
 * so there are past and future reservations. Assertions are relational (e.g. "every row
 * has status booked") and never depend on exact seeded counts.
 */
test.describe('Admin · Reservations table', () => {
  let admin: AdminPage

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page)
    await page.goto(adminUrl('', { seed: 'demo' }))
    await admin.goToReservations()
  })

  test('filtering by status only shows rows with that status, and Clear restores the list', async ({ page }) => {
    const totalBefore = await page.getByTestId('result-count').textContent()

    await admin.filterByStatus('booked')
    await expect(admin.reservationRows().first()).toBeVisible()
    await expect(page.locator('[data-testid^="res-row-"]:not([data-status="booked"])')).toHaveCount(0)

    await page.getByTestId('filter-clear').click()
    await expect(page.getByTestId('result-count')).toHaveText(totalBefore!)
  })

  test('filtering by date range only shows reservations inside the range', async ({ page }) => {
    // Club clock is 2026-10-10: this range is entirely in the past
    await page.getByTestId('filter-from').fill('2026-10-03')
    await page.getByTestId('filter-to').fill('2026-10-09')

    await expect(admin.reservationRows().first()).toBeVisible()
    const dates = await admin.reservationColumn('res-date-')
    expect(dates.length).toBeGreaterThan(0)
    for (const d of dates) {
      expect(d >= '2026-10-03' && d <= '2026-10-09').toBe(true)
    }
  })

  test('filtering by court only shows that court', async ({ page }) => {
    await page.getByTestId('filter-court').selectOption('court-1')

    await expect(admin.reservationRows().first()).toBeVisible()
    const courts = await admin.reservationColumn('res-court-')
    expect(courts.length).toBeGreaterThan(0)
    expect(new Set(courts)).toEqual(new Set(['Court 1']))
  })

  test('a filter with no matches shows the empty state', async ({ page }) => {
    await page.getByTestId('filter-from').fill('2030-01-01')

    await expect(page.getByTestId('reservations-empty')).toHaveText('No reservations match the filters.')
    await expect(page.getByTestId('result-count')).toHaveText('0 results')
    await expect(admin.reservationRows()).toHaveCount(0)
  })

  test('sorting by price toggles ascending / descending and orders the rows', async ({ page }) => {
    const prices = async () => (await admin.reservationColumn('res-price-')).map((t) => parseInt(t, 10))

    // First click on a new column sorts ascending
    await admin.sortBy('price')
    await expect(admin.sortHeader('price')).toHaveAttribute('aria-sort', 'ascending')
    const asc = await prices()
    expect(asc).toEqual([...asc].sort((a, b) => a - b))

    // Second click flips to descending
    await admin.sortBy('price')
    await expect(admin.sortHeader('price')).toHaveAttribute('aria-sort', 'descending')
    const desc = await prices()
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
  })

  test('pagination moves between pages and the page size changes the page count', async ({ page }) => {
    await expect(page.getByTestId('page-info')).toHaveText(/^Page 1 of (\d+)$/)
    await expect(page.getByTestId('page-prev')).toBeDisabled()
    await expect(admin.reservationRows()).toHaveCount(10)

    await page.getByTestId('page-next').click()
    await expect(page.getByTestId('page-info')).toHaveText(/^Page 2 of /)
    await expect(page.getByTestId('page-prev')).toBeEnabled()

    // 50 rows per page fits the whole demo seed (~40 reservations) on one page
    await page.getByTestId('page-size').selectOption('50')
    await expect(page.getByTestId('page-info')).toHaveText('Page 1 of 1')
    await expect(page.getByTestId('page-next')).toBeDisabled()
  })

  test('exports the filtered reservations as reservations.csv', async ({ page }) => {
    await admin.filterByStatus('booked')
    await expect(admin.reservationRows().first()).toBeVisible()
    const countText = (await page.getByTestId('result-count').textContent())!
    const expectedRows = parseInt(countText, 10)

    const download = await admin.exportCsv()
    expect(download.suggestedFilename()).toBe('reservations.csv')

    const csv = readFileSync((await download.path())!, 'utf-8').trim().split('\n')
    expect(csv[0]).toBe('id,date,start,end,court,player,partner,status,price,cancelReason')
    // header + one line per filtered row (export ignores pagination)
    expect(csv.length - 1).toBe(expectedRows)
    // every exported row is a booked reservation
    for (const line of csv.slice(1)) {
      expect(line).toContain('"booked"')
    }
  })

  test('marking a booked reservation as no-show updates its status and disables its actions', async ({ page }) => {
    await admin.filterByStatus('booked')
    const row = admin.firstRowWithStatus('booked')
    await expect(row).toBeVisible()
    const resId = await admin.resIdFromRow(row)

    await admin.markNoShow(resId)
    await expect(admin.toast('Marked as no-show')).toBeVisible()

    // It leaves the "booked" filter and shows up under "no-show"
    await expect(page.getByTestId(`res-row-${resId}`)).toHaveCount(0)
    await admin.filterByStatus('no-show')
    const noShowRow = page.getByTestId(`res-row-${resId}`)
    await expect(noShowRow).toBeVisible()
    await expect(noShowRow).toHaveAttribute('data-status', 'no-show')
    await expect(page.getByTestId(`res-noshow-${resId}`)).toBeDisabled()
    await expect(page.getByTestId(`res-cancel-${resId}`)).toBeDisabled()
  })

  test('"Keep" in the cancel dialog leaves the reservation booked', async ({ page }) => {
    await admin.filterByStatus('booked')
    const row = admin.firstRowWithStatus('booked')
    await expect(row).toBeVisible()
    const resId = await admin.resIdFromRow(row)

    await page.getByTestId(`res-cancel-${resId}`).click()
    await expect(page.getByTestId('res-cancel-dialog')).toBeVisible()
    await page.getByTestId('res-cancel-dismiss').click()

    await expect(page.getByTestId('res-cancel-dialog')).toBeHidden()
    await expect(page.getByTestId(`res-row-${resId}`)).toHaveAttribute('data-status', 'booked')
  })
})
