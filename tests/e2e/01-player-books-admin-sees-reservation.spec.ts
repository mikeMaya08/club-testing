import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 01 — Player books a court → Admin sees it in Reservations
 *
 * Journey:
 *  1. Player (player-1 / Lucía Fernández) opens the Availability page
 *     on a fresh demo seed and books the first available slot.
 *  2. The booking modal closes and the reservation appears in the
 *     player's Upcoming tab.
 *  3. The admin navigates to the Reservations table, filters by
 *     the player's name, and confirms the same reservation is listed
 *     with status "booked".
 */
test('player books a court and admin sees the reservation', async ({ page }) => {
  // ── Step 1: Player logs in and navigates to availability ──────────────────
  const player = new PlayerPage(page)

  // Fresh seed so the test is fully deterministic
  await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
  await player.goToAvailability()

  // Pick the first free slot on the grid and complete the 3-step booking modal
  await player.clickFirstAvailableSlot()
  await player.confirmBooking()

  // ── Step 2: Reservation appears in the player's Upcoming tab ──────────────
  await player.goToReservations()
  await player.selectTab('upcoming')

  const upcomingRows = player.reservationRows('upcoming')
  await expect(upcomingRows.first()).toBeVisible()

  // Grab the id so we can verify the same one on the admin side
  const firstRow = upcomingRows.first()
  const resTestId = await firstRow.getAttribute('data-testid') // "reservation-res-1"
  const resId = resTestId!.replace('reservation-', '')
  expect(await player.reservationStatus(resId)).toBe('booked')

  // ── Step 3: Admin filters reservations by player and confirms entry ────────
  const admin = new AdminPage(page)

  // Preserve localStorage (no reset) so the booking the player just made is still there
  await page.goto(adminUrl('reservations', { reset: false }))
  await admin.loginAs('admin-1')

  // Filter by player-1 (Lucía Fernández)
  await page.getByTestId('filter-player').selectOption('player-1')

  // At least one booked row should be visible
  const bookedRow = admin.firstRowWithStatus('booked')
  await expect(bookedRow).toBeVisible()
})
