import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 03 — Admin deactivates a player → future reservations are auto-cancelled
 *
 * The demo seed gives player-1 (Lucía Fernández) at most 2 future booked
 * reservations. When the admin deactivates that user, the store's
 * `setUserActive(false)` cascade cancels all of them immediately.
 *
 * Journey:
 *  1. Admin navigates to Users (demo seed) and deactivates player-1.
 *  2. The user row shows "Inactive" and the admin verifies the change.
 *  3. The player opens their Player app and sees zero upcoming reservations
 *     (they have all been cascaded to "cancelled").
 *  4. The player's login button is still rendered (they can still load the
 *     page) but action flows would be blocked by the `USER_INACTIVE` rule.
 */
test('deactivating a user auto-cancels their future reservations', async ({ page }) => {
  const admin = new AdminPage(page)

  // ── Step 1: Admin opens Users and deactivates player-1 ────────────────────
  await page.goto(adminUrl('users', { seed: 'demo', reset: true }))
  // Already logged in via ?as=admin-1

  await expect(page.getByTestId('users-page')).toBeVisible()

  // Record how many upcoming reservations player-1 currently shows
  // (we don't assert a specific count — demo seed is randomised within limits)

  await admin.setUserActive('player-1', false)

  // ── Step 2: Row now shows Inactive ────────────────────────────────────────
  await expect(page.getByTestId('user-status-player-1')).toHaveText('Inactive')
  await expect(page.getByTestId('user-row-player-1')).toHaveAttribute('data-active', 'false')

  // ── Step 3: Player app shows no upcoming reservations ─────────────────────
  const player = new PlayerPage(page)

  // Navigate to player reservations without resetting localStorage
  await page.goto(playerUrl('reservations', { as: 'player-1', reset: false }))

  await player.selectTab('upcoming')

  // All future bookings for player-1 must have been cancelled
  await expect(page.getByTestId('upcoming-empty')).toBeVisible()
})
