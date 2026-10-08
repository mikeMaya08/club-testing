import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 02 — Admin cancels a player's reservation → Player sees notification
 *
 * Journey:
 *  1. Admin opens Reservations (demo seed) and cancels a booked reservation
 *     that belongs to player-1 (Lucía Fernández).
 *  2. The row's status immediately updates to "cancelled".
 *  3. The player opens the Player app, switches to History, and confirms
 *     the reservation is listed as "cancelled".
 *  4. The player opens the notification bell and sees the cancellation message.
 */
test('admin cancels reservation and player is notified', async ({ page }) => {
  const admin = new AdminPage(page)

  // ── Step 1: Admin cancels a booked reservation for player-1 ───────────────
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))
  admin.loginAs('admin-1') // already logged in via ?as=

  // Filter to booked reservations belonging to player-1 (Lucía Fernández)
  await page.getByTestId('filter-status').selectOption('booked')
  await page.getByTestId('filter-player').selectOption('player-1')

  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()

  const resId = await admin.resIdFromRow(row)
  await admin.cancelReservation(resId)

  // ── Step 2: Row status updates in-place to "cancelled" ────────────────────
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('cancelled')

  // ── Step 3: Player checks their History tab ────────────────────────────────
  const player = new PlayerPage(page)

  // Navigate to player app without resetting — the cancellation must survive
  await page.goto(playerUrl('reservations', { as: 'player-1', reset: false }))

  await player.selectTab('history')

  // The cancelled reservation must appear in history
  const cancelledRow = page.locator(`[data-testid="reservation-${resId}"]`)
  await expect(cancelledRow).toBeVisible()
  expect(await player.reservationStatus(resId)).toBe('cancelled')

  // ── Step 4: Notification bell shows the cancellation message ──────────────
  await player.openNotifications()
  await expect(player.notificationWithText('cancelled by the club')).toBeVisible()
})
