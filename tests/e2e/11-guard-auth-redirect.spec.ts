import { test, expect } from '@playwright/test'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 11 — Guard: authentication and role enforcement
 *
 * Guard redirects to /login when there is no session, the user is inactive,
 * or the user has the wrong role. When the session is valid, the player is
 * passed to child pages via useMe() (Outlet context).
 *
 * Covered by club-player PR #3 (docs/code-comments) which clarified:
 *  - Guard redirects inactive / wrong-role users with a message in location state.
 *  - Pages read the logged-in player with `useMe()` instead of re-checking the session.
 *
 * Happy paths:
 *  - A valid player session lands on the player home page.
 *  - The current player's name is visible in the header (useMe() works).
 *
 * Negative paths:
 *  - Navigating to a protected route without a session redirects to /login.
 *  - An inactive player is redirected to /login with a deactivation message.
 *  - A user with the wrong role (admin) is redirected to /login with a role message.
 */

test.describe('Guard — authentication and role enforcement', () => {
  // ── Happy path: valid player session ────────────────────────────────────────

  test('valid player session lands on the player home page', async ({ page }) => {
    // ?as=player-1 pre-logs in as Lucía Fernández (a valid active player)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    // Guard passes — we should NOT be on /login
    await expect(page).not.toHaveURL(/\/login/)

    // The availability page (default route) or nav should be visible
    await expect(page.getByTestId('app-name')).toBeVisible()
  })

  test('current player name is shown in the header via useMe()', async ({ page }) => {
    // player-1 is "Lucía Fernández" in the demo seed
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    await expect(page).not.toHaveURL(/\/login/)
    // Header renders the player's name from useMe()
    await expect(page.getByTestId('current-user')).toContainText('Lucía')
  })

  // ── Negative path: no session ────────────────────────────────────────────────

  test('navigating to a protected route without a session redirects to /login', async ({ page }) => {
    // No ?as= param → no session in localStorage → Guard should redirect
    await page.goto(playerUrl('reservations', { seed: 'empty', reset: true }))

    // Guard redirects unauthenticated visitors to /login
    await expect(page).toHaveURL(/\/login/)
  })

  // ── Negative path: inactive player ──────────────────────────────────────────

  test('inactive player is redirected to /login with a deactivation message', async ({ page }) => {
    // player-6 is deactivated in the demo seed
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-6', reset: true }))

    // Guard detects status === 'inactive' and redirects
    await expect(page).toHaveURL(/\/login/)

    // The login page should surface the message passed via location state
    await expect(page.getByText('deactivated')).toBeVisible()
  })

  // ── Negative path: wrong role ────────────────────────────────────────────────

  test('admin user is redirected to /login with a wrong-role message', async ({ page }) => {
    // admin-1 has role 'admin', not 'player' — Guard should reject them
    await page.goto(playerUrl('', { seed: 'demo', as: 'admin-1', reset: true }))

    // Guard detects status === 'wrong-role' and redirects
    await expect(page).toHaveURL(/\/login/)

    // The login page should surface the role-mismatch message
    await expect(page.getByText(/cannot use the player app/i)).toBeVisible()
  })
})
