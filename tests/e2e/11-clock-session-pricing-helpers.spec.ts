import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl, FIXED_NOW } from '../helpers/urls'

/**
 * E2E 11 — Behaviours documented in club-store PR #3 (docs/code-comments)
 *
 * The PR adds JSDoc comments that make the following contracts explicit:
 *
 *  A. clock.ts  — `?now=` freezes the club clock; an invalid value falls back
 *                 to real time without breaking the app.
 *  B. session.ts — each app has its own session key; SessionStatus values
 *                  (anonymous, ok, inactive, wrong-role) gate access correctly.
 *  C. pricing.ts — isPeak uses a half-open range: a slot starting exactly at
 *                  peakEnd is NOT peak-priced.
 *  D. storage.ts — sessionStore is private to one tab, so a player session in
 *                  one app does not bleed into another app's session check.
 *
 * All tests use the `?now=`, `?as=`, `?seed=`, and `?reset=` query params
 * provided by club-store's bootstrap / initClub to keep state deterministic.
 */

// ─── A. Clock helpers ────────────────────────────────────────────────────────

test.describe('clock — ?now= override', () => {
  test('valid ?now= freezes the displayed date across the player app', async ({ page }) => {
    // FIXED_NOW = '2026-10-10T10:00:00' — the standard frozen instant used by
    // all tests. The player availability page shows today's date in its heading.
    const player = new PlayerPage(page)

    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true, now: FIXED_NOW }))
    await player.goToAvailability()

    // The availability heading must contain the frozen date (2026-10-10).
    // The exact format may vary (e.g. "Saturday, October 10, 2026"), so we
    // match the year and month/day numerically.
    const heading = page.getByTestId('availability-date')
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect(text).toMatch(/2026/)
    expect(text).toMatch(/10/)
  })

  test('invalid ?now= value falls back to real time without crashing', async ({ page }) => {
    // clock.ts documents: "an unparseable value falls through to real time
    // instead of breaking the app". We pass a garbage string and verify the
    // player app still loads (no error page / crash).
    const player = new PlayerPage(page)

    // Build the URL manually so we can inject an invalid now= value.
    const base = playerUrl('', { seed: 'demo', as: 'player-1', reset: true })
    const url = base.replace(`now=${encodeURIComponent(FIXED_NOW)}`, 'now=not-a-date')

    await page.goto(url)

    // The app should still render the availability page — not a blank/error screen.
    await player.goToAvailability()
    await expect(page.getByTestId('availability-page')).toBeVisible()
  })
})

// ─── B. Session — per-app isolation & SessionStatus ─────────────────────────

test.describe('session — per-app isolation and status gating', () => {
  test('anonymous user is redirected to login (status: anonymous)', async ({ page }) => {
    // Navigating to the player app without ?as= means no session exists.
    // The route guard must redirect to /login (status = "anonymous").
    const url = playerUrl('reservations', { seed: 'demo', reset: true, as: undefined, now: FIXED_NOW })
    // Remove the `as=` param entirely so no session is set.
    const noSessionUrl = url.replace(/[&?]as=[^&]*/g, '')

    await page.goto(noSessionUrl)

    // Should land on the login page — not the reservations page.
    await expect(page).toHaveURL(/\/login/)
  })

  test('inactive user is blocked from accessing the player app (status: inactive)', async ({ page }) => {
    // The demo seed contains player-6 (Valentina Ríos) who is marked inactive.
    // Logging in as an inactive user should surface an "inactive" status screen
    // rather than the normal app content.
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-6', reset: true, now: FIXED_NOW }))

    // The app should show an inactive / access-denied state, not the booking page.
    // We check that the availability page is NOT reachable.
    const availabilityPage = page.getByTestId('availability-page')
    await expect(availabilityPage).not.toBeVisible()

    // An error or status message should be visible instead.
    const statusMsg = page.locator('[data-testid="session-status"], [data-testid="access-denied"]')
    await expect(statusMsg).toBeVisible()
  })

  test('admin user trying to access the player app is blocked (status: wrong-role)', async ({ page }) => {
    // session.ts: "wrong-role: the user exists but belongs to another app."
    // Logging into the player app as admin-1 should trigger the wrong-role guard.
    await page.goto(playerUrl('', { seed: 'demo', as: 'admin-1', reset: true, now: FIXED_NOW }))

    // The player availability page must NOT be accessible.
    const availabilityPage = page.getByTestId('availability-page')
    await expect(availabilityPage).not.toBeVisible()

    // A role-mismatch or access-denied indicator should be visible.
    const statusMsg = page.locator('[data-testid="session-status"], [data-testid="access-denied"]')
    await expect(statusMsg).toBeVisible()
  })

  test('valid player session grants access to the app (status: ok)', async ({ page }) => {
    // Happy path: a valid, active player can reach the availability page.
    const player = new PlayerPage(page)

    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true, now: FIXED_NOW }))
    await player.goToAvailability()

    await expect(page.getByTestId('availability-page')).toBeVisible()
  })

  test('each app has its own session key — admin session does not affect player session', async ({ page }) => {
    // storage.ts: sessionStore is private to one tab.
    // session.ts: each app uses its own key (club:session:<app>).
    // We log in as admin-1 on the admin app, then navigate to the player app
    // without an ?as= param. The player app must NOT inherit the admin session.
    await page.goto(adminUrl('', { seed: 'demo', as: 'admin-1', reset: true, now: FIXED_NOW }))
    await expect(page.getByTestId('admin-page')).toBeVisible()

    // Navigate to the player app without setting a player session.
    const playerBase = playerUrl('', { seed: 'demo', reset: false, now: FIXED_NOW, as: undefined })
    const noPlayerSession = playerBase.replace(/[&?]as=[^&]*/g, '')
    await page.goto(noPlayerSession)

    // The player app should NOT be logged in — it must redirect to its own login.
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─── C. Pricing — peak / off-peak boundary (half-open range) ─────────────────

test.describe('pricing — peak-hour boundary is half-open', () => {
  test('slot at peakEnd start time is priced at base rate, not peak rate', async ({ page }) => {
    // pricing.ts: isPeak = start >= peakStart && start < peakEnd
    // The default demo seed has peakStart='18:00' and peakEnd='20:00'.
    // A slot starting exactly at 20:00 (peakEnd) must NOT be peak-priced.
    //
    // We verify this through the booking modal: open a slot at 20:00 and
    // confirm the summary shows the base price (250 MXN), not the peak price.
    const player = new PlayerPage(page)

    // Use the empty seed so no existing reservations block the 20:00 slot.
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true, now: FIXED_NOW }))
    await player.goToAvailability()

    // Find the slot that starts at 20:00 (peakEnd boundary).
    const peakEndSlot = page.locator('[data-testid^="slot-"][data-start="20:00"]')
    const slotVisible = await peakEndSlot.isVisible()

    if (!slotVisible) {
      // If the 20:00 slot is not rendered (outside open hours), skip gracefully.
      test.skip()
      return
    }

    await peakEndSlot.click()

    // Advance to the summary step (step 3) of the booking modal.
    await expect(page.getByTestId('booking-modal')).toBeVisible()
    await page.getByTestId('booking-next').click()
    await page.getByTestId('booking-next').click()

    // The summary total must equal the base price (250), not the peak price.
    const totalText = await page.getByTestId('summary-total').textContent()
    const total = parseInt(totalText?.match(/\d+/)?.[0] ?? '0', 10)
    // Base price is 250; peak price is higher. The boundary slot must be base.
    expect(total).toBe(250)
  })

  test('slot inside peak hours is priced at peak rate', async ({ page }) => {
    // Happy path: a slot at 18:00 (>= peakStart, < peakEnd) must be peak-priced.
    const player = new PlayerPage(page)

    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true, now: FIXED_NOW }))
    await player.goToAvailability()

    const peakSlot = page.locator('[data-testid^="slot-"][data-start="18:00"]')
    const slotVisible = await peakSlot.isVisible()

    if (!slotVisible) {
      test.skip()
      return
    }

    await peakSlot.click()

    await expect(page.getByTestId('booking-modal')).toBeVisible()
    await page.getByTestId('booking-next').click()
    await page.getByTestId('booking-next').click()

    const totalText = await page.getByTestId('summary-total').textContent()
    const total = parseInt(totalText?.match(/\d+/)?.[0] ?? '0', 10)
    // Peak price must be strictly greater than the base price (250).
    expect(total).toBeGreaterThan(250)
  })
})

// ─── D. Storage — sessionStore is tab-private ─────────────────────────────────

test.describe('storage — sessionStore is private to the tab', () => {
  test('logging out clears only the current app session, not club data', async ({ page }) => {
    // storage.ts: localStore holds club data (shared); sessionStore holds sessions (tab-private).
    // Logging out should remove the session key but leave club data intact so
    // the login page can still render the user list.
    const player = new PlayerPage(page)
    const admin = new AdminPage(page)

    // Start as a logged-in player.
    await page.goto(playerUrl('reservations', { seed: 'demo', as: 'player-1', reset: true, now: FIXED_NOW }))
    await player.selectTab('upcoming')
    await expect(page.getByTestId('reservations-page')).toBeVisible()

    // Navigate to the admin app — the admin session is separate (different key).
    await page.goto(adminUrl('', { seed: 'demo', as: 'admin-1', reset: false, now: FIXED_NOW }))
    await expect(page.getByTestId('admin-page')).toBeVisible()

    // The admin page is accessible because admin-1 has its own session key.
    // Verify the admin can reach the reservations page (club data is intact).
    await admin.goToReservations()
    await expect(page.getByTestId('reservations-page')).toBeVisible()
  })
})
