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
  // Already logged in via ?as=admin-1 — no loginAs() needed

  // Filter to booked reservations belonging to player-1 (Lucía Fernández)
  await page.getByTestId('filter-status').selectOption('booked')
  await page.getByTestId('filter-player').selectOption('player-1')

  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()

  const resId = await admin.resIdFromRow(row)
  await admin.cancelReservation(resId)

  // ── Step 2: Clear the status filter so the cancelled row is still visible ──
  // The "booked" filter hides cancelled rows; clear it to see the updated status.
  await page.getByTestId('filter-clear').click()
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('cancelled')

  // ── Step 3: Player checks their History tab ────────────────────────────────
  // The player app is on a different origin — it has its own localStorage.
  // We navigate with reset=false so the store already contains the cancellation
  // the admin just performed (same shared in-memory store, same seed session).
  const player = new PlayerPage(page)

  await page.goto(playerUrl('reservations', { seed: 'demo', as: 'player-1', reset: false }))
  await player.selectTab('history')

  // Assert the specific reservation we just cancelled appears as "cancelled"
  // via its status badge (data-testid="reservation-status-{resId}").
  await expect(page.getByTestId(`reservation-status-${resId}`)).toHaveText('cancelled')

  // ── Step 4: Notification bell shows a cancellation message ────────────────
  await player.openNotifications()
  await expect(player.notificationWithText('cancelled')).toBeVisible()
})
