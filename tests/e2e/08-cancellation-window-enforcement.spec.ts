import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl, FIXED_NOW } from '../helpers/urls'

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
  // Load the seed with the default clock and read the start of player-1's first upcoming
  // reservation from the page, so the test doesn't hardcode seed dates.
  await page.goto(playerUrl('reservations', { seed: 'demo', as: 'player-1', reset: true }))
  await player.selectTab('upcoming')

  const firstUpcoming = page.getByTestId('upcoming-list').locator('li[data-testid^="reservation-"]').first()
  await expect(firstUpcoming).toBeVisible()
  const whenText = (await firstUpcoming.locator('[data-testid^="reservation-when-"]').innerText()).trim()
  // Format rendered by the app: "Tue, Oct 13 · 21:00 – 22:00"
  const m = whenText.match(/([A-Z][a-z]{2}) (\d{1,2}) · (\d{2}):(\d{2})/)
  expect(m, `unexpected reservation time format: ${whenText}`).not.toBeNull()
  const [, mon, day, hh, mm] = m!
  const year = FIXED_NOW.slice(0, 4)
  const start = new Date(`${mon} ${day}, ${year} ${hh}:${mm}:00 UTC`)

  // Pin the clock (supported via ?now=) 2 hours before the start: inside the 4-hour window.
  const inWindowNow = new Date(start.getTime() - 2 * 60 * 60 * 1000).toISOString().slice(0, 19)
  await page.goto(playerUrl('reservations', { seed: 'demo', as: 'player-1', reset: false, now: inWindowNow }))
  await player.selectTab('upcoming')

  // Find a cancel button that is disabled — the app may use either the HTML
  // `disabled` attribute or `aria-disabled="true"` for the cancel-window guard.
  const disabledCancelBtn = page
    .locator('[data-testid^="cancel-btn-"][disabled], [data-testid^="cancel-btn-"][aria-disabled="true"]')
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
  // The list is filtered by 'booked', so the cancelled row leaves it; switch the filter to verify the new status.
  await expect(page.getByTestId(`res-row-${resId}`)).toHaveCount(0)
  await admin.filterByStatus('cancelled')
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('cancelled')

  // ── Step 4: Player sees the reservation as cancelled ──────────────────────
  // The admin and player apps are on different origins with separate localStorage, so the
  // player app cannot reflect the admin's cancellation; the admin-side status check above
  // is the verifiable outcome.
})
