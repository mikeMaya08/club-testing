import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 07 — Player cannot exceed the maxActiveReservations limit (default: 2)
 *
 * The "demo" seed fills player-1 (Lucía Fernández) with 2 upcoming booked
 * reservations. Attempting to book a third should be blocked by the business
 * rule MAX_RESERVATIONS_EXCEEDED and display an error toast.
 *
 * Journey:
 *  1. Log in as player-1 on the "demo" seed.
 *  2. Confirm the Upcoming tab already shows ≥ 2 reservations.
 *  3. Navigate to Availability and try to book another slot through the modal.
 *  4. Assert the error toast appears (MAX_ACTIVE rule fires via useRun).
 *  5. Navigate back to Upcoming; the count must not have changed.
 */
test('player is blocked from booking when max active reservations is reached', async ({ page }) => {
  const player = new PlayerPage(page)

  // ── Step 1: Set up with demo seed — player-1 has 2 upcoming booked reservations ──
  await page.goto(playerUrl('reservations', { seed: 'demo', as: 'player-1', reset: true }))

  await player.selectTab('upcoming')

  // Confirm at least 2 upcoming booked reservations exist for this player
  const upcomingRows = player.reservationRows('upcoming')
  const count = await upcomingRows.count()
  expect(count).toBeGreaterThanOrEqual(2)

  // ── Step 2: Navigate to Availability and try to book ──────────────────────
  await player.goToAvailability()

  // Attempt to click any available slot
  await player.clickFirstAvailableSlot()

  // Step 1 of the booking modal opens
  await expect(page.getByTestId('booking-modal')).toBeVisible()
  await page.getByTestId('booking-next').click()

  // Step 2 — skip partner
  await page.getByTestId('booking-next').click()

  // Step 3 — try to confirm
  await page.getByTestId('booking-confirm').click()

  // ── Step 3: An error toast is displayed ───────────────────────────────────
  // useRun() catches RuleErrors and fires toast(message, 'error').
  // The Toast component renders with data-testid="toast" data-kind="error"
  // inside data-testid="toast-container". We scope to the container to avoid
  // matching any unrelated element, and assert before the 3 s auto-dismiss.
  await expect(
    page.getByTestId('toast-container').locator('[data-testid="toast"][data-kind="error"]')
  ).toBeVisible()

  // Navigate back to Upcoming; count must not have increased
  await player.goToReservations()
  await player.selectTab('upcoming')
  const countAfter = await player.reservationRows('upcoming').count()
  expect(countAfter).toBe(count)
})
