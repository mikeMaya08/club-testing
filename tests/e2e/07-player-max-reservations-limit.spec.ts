import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 07 — Player cannot exceed the maxActiveReservations limit (default: 2)
 *
 * The "full" seed fills every slot with existing reservations (assigned to
 * players 7–12). player-7 already has 2 future booked reservations from the
 * seed. Attempting to book a third should be blocked by the business rule
 * MAX_RESERVATIONS_EXCEEDED and display an error in the booking modal.
 *
 * Journey:
 *  1. Log in as player-7 (Sofía Navarro) on the "full" seed.
 *  2. Confirm the Upcoming tab already shows 2 reservations.
 *  3. Navigate to Availability and try to open a slot.
 *  4. Assert the booking modal shows the MAX_RESERVATIONS_EXCEEDED error,
 *     and no new reservation is added to the Upcoming list.
 */
test('player is blocked from booking when max active reservations is reached', async ({ page }) => {
  const player = new PlayerPage(page)

  // ── Step 1: Set up with full seed — player-7 has 2 upcoming booked reservations ──
  // The 'full' seed is specifically designed with players 7–12 having maxed-out bookings.
  await page.goto(playerUrl('reservations', { seed: 'full', as: 'player-7', reset: true }))

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

  // ── Step 3: An error toast is displayed; the modal stays open ────────────
  // useRun() surfaces all rule errors as toasts with data-kind="error".
  // The MAX_ACTIVE rule fires and the booking is rejected.
  // The toast auto-dismisses after 3 s — assert immediately after clicking confirm.
  const errorToast = page.locator('[data-testid="toast"][data-kind="error"]')
  await expect(errorToast).toBeVisible({ timeout: 5000 })

  // The modal must remain open (booking was rejected, not closed on success).
  await expect(page.getByTestId('booking-modal')).toBeVisible()

  // Navigate back to Upcoming; count must not have increased
  await player.goToReservations()
  await player.selectTab('upcoming')
  const countAfter = await player.reservationRows('upcoming').count()
  expect(countAfter).toBe(count)
})
