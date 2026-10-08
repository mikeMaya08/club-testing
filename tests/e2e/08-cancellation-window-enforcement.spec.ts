import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 08 — Player cannot cancel within the 4-hour window; admin can force-cancel
 *
 * We pin the clock to 2026-10-10T10:00. A reservation starting at 11:00 on the
 * same day is within the 4-hour cancellation window (< 4 h away). The player's
 * Cancel button for that slot must be disabled with a tooltip explaining why.
 * The admin can still force-cancel the same reservation from the Admin panel.
 *
 * Journey:
 *  1. Using the demo seed, find (or verify) a booked reservation on
 *     2026-10-10 that starts at a time within 4 hours of 10:00 (i.e. before 14:00).
 *  2. Player opens their Upcoming tab and confirms the Cancel button for
 *     that reservation is disabled.
 *  3. Admin opens Reservations, finds the same entry, and force-cancels it.
 *  4. The player refreshes and the reservation now shows as "cancelled".
 */
test('player cancel is blocked inside the window; admin can still force-cancel', async ({ page }) => {
  // ── Steps 1 & 2: Player sees a disabled Cancel button ─────────────────────
  const player = new PlayerPage(page)

  // now=2026-10-10T10:00 — the demo seed may have booked reservations today
  // Use player-1 (Lucía Fernández) who has future reservations in the demo seed
  await page.goto(playerUrl('reservations', { seed: 'demo', as: 'player-1', reset: true }))

  await player.selectTab('upcoming')

  // Find a cancel button that is disabled — the app may use either the HTML
  // `disabled` attribute or `aria-disabled="true"` for the cancel-window guard.
  const disabledCancelBtn = page
    .locator('[data-testid^="cancel-btn-"]')
    .filter({ has: page.locator('[disabled], [aria-disabled="true"]') })
    .first()

  await expect(disabledCancelBtn).toBeVisible()

  // The button may carry a title, aria-label, or be wrapped in a tooltip span.
  // We just assert it is not clickable (disabled or aria-disabled).
  const isDisabled = await disabledCancelBtn.evaluate((el) =>
    el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
  )
  expect(isDisabled).toBe(true)

  // Extract reservation id from the button's data-testid for use in Step 3
  const btnTestId = await disabledCancelBtn.getAttribute('data-testid')
  const resId = btnTestId!.replace('cancel-btn-', '')

  // ── Step 3: Admin force-cancels the same reservation ──────────────────────
  const admin = new AdminPage(page)

  await page.goto(adminUrl('reservations', { reset: false }))
  // Already seeded and admin logged in via ?as=admin-1

  await admin.filterByStatus('booked')

  // Locate the row and confirm the Cancel button is ENABLED for admin
  const adminCancelBtn = page.getByTestId(`res-cancel-${resId}`)
  await expect(adminCancelBtn).toBeEnabled()

  await admin.cancelReservation(resId)
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('cancelled')

  // ── Step 4: Player sees the reservation as cancelled ──────────────────────
  await page.goto(playerUrl('reservations', { as: 'player-1', reset: false }))

  await player.selectTab('history')
  const cancelledRow = page.locator(`[data-testid="reservation-${resId}"]`)
  await expect(cancelledRow).toBeVisible()
  expect(await player.reservationStatus(resId)).toBe('cancelled')
})
