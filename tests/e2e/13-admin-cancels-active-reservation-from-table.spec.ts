import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 13 — Admin cancels an active reservation from the Reservations table
 *
 * Journey:
 *  1. Admin opens Reservations on a fresh demo seed (already logged in
 *     via ?as=admin-1, as in the other specs).
 *  2. Admin picks an active ("booked") reservation and records its id.
 *  3. Admin cancels it from the table and confirms the dialog.
 *  4. The SAME reservation (same id) shows "canceled" in its status cell.
 */
test('admin cancels an active reservation from the table and it shows as canceled', async ({ page }) => {
  const admin = new AdminPage(page)

  // ── Step 1: Open the Reservations table on a deterministic seed ───────────
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))
  await expect(page.getByTestId('reservations-page')).toBeVisible()

  // ── Step 2: Pick an active (booked) reservation and keep its id ───────────
  await admin.filterByStatus('booked')
  const activeRow = admin.firstRowWithStatus('booked')
  await expect(activeRow).toBeVisible()
  const resId = await admin.resIdFromRow(activeRow)

  // ── Step 3: Cancel it from the table (click + confirm dialog) ─────────────
  await admin.cancelReservation(resId)

  // ── Step 4: The same reservation now shows as canceled ────────────────────
  // The "booked" filter hides canceled rows, so clear it first (as in spec 02).
  await page.getByTestId('filter-clear').click()
  // The app renders the American spelling "canceled" (observed in run #26).
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('canceled')
})
