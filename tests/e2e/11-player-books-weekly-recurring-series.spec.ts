import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 11 — Player books a weekly recurring series
 *
 * Rules under test (club-store bookRecurring / cancelSeries):
 *  - "Every week for N weeks" books N sessions, all-or-nothing.
 *  - The summary lists every date and the total (per-session price x N).
 *  - A whole series counts as ONE active reservation toward
 *    maxActiveReservations (default: 2).
 *  - "Cancel series" cancels every session still outside the cancellation window.
 *
 * Uses the "empty" seed (no reservations) and a date 3 days after the frozen
 * clock (FIXED_NOW = 2026-10-10), so every session is outside the cancellation window.
 */

const FIRST_DATE = '2026-10-13'
const SERIES_DATES = 'Oct 13, Oct 20, Oct 27, Nov 3'
const WEEKS = 4

/** "30 EUR × 4" / "120 EUR" -> 30 / 120 */
const amount = (text: string | null) => parseInt(text ?? '', 10)

test.describe('Weekly recurring booking', () => {
  test('player books a 4-week series and can cancel the whole series', async ({ page }) => {
    const player = new PlayerPage(page)

    // ── Step 1: fresh state, logged in as player-1 with no reservations ──────
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
    await player.goToAvailability()
    await player.selectDate(FIRST_DATE)

    // ── Step 2: open a free slot and choose a 4-week repeat ──────────────────
    await player.clickFirstAvailableSlot()
    await expect(page.getByTestId('booking-modal')).toBeVisible()
    await player.chooseRepeatWeeks(WEEKS)
    await player.advanceToBookingSummary()

    // ── Step 3: the summary shows every date and total = per session x 4 ─────
    await expect(page.getByTestId('summary-series')).toHaveText(`${WEEKS} sessions: ${SERIES_DATES}`)
    const perSession = amount(await page.getByTestId('summary-per-session').textContent())
    expect(perSession).toBeGreaterThan(0)
    expect(amount(await page.getByTestId('summary-total').textContent())).toBe(perSession * WEEKS)

    await player.submitBooking()
    await expect(player.toast('success', `Weekly series booked (${WEEKS} sessions)`)).toBeVisible()

    // ── Step 4: Upcoming shows 4 sessions flagged as one weekly series ───────
    await player.goToReservations()
    await player.selectTab('upcoming')
    await expect(player.upcomingBookedRows()).toHaveCount(WEEKS)
    await expect(player.seriesBadges()).toHaveCount(WEEKS)
    await expect(page.getByTestId('tab-upcoming')).toHaveText(`Upcoming (${WEEKS})`)
    await expect(player.cancelSeriesButton()).toHaveCount(1)

    // ── Step 5: cancel the whole series ──────────────────────────────────────
    await player.cancelSeriesButton().click()
    await expect(page.getByTestId('cancel-series-text')).toContainText(
      `${WEEKS} of ${WEEKS} upcoming sessions will be cancelled.`,
    )
    await page.getByTestId('cancel-series-confirm').click()

    await expect(player.toast('success', `${WEEKS} sessions cancelled`)).toBeVisible()
    await expect(page.getByTestId('tab-upcoming')).toHaveText('Upcoming (0)')
    await expect(page.getByTestId('upcoming-empty')).toBeVisible()
  })

  test('a whole series counts as one active reservation toward the limit', async ({ page }) => {
    const player = new PlayerPage(page)

    /** Open the first free slot on FIRST_DATE. */
    const openFreeSlot = async () => {
      await player.goToAvailability()
      await player.selectDate(FIRST_DATE)
      await player.clickFirstAvailableSlot()
    }

    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))

    // 1st active reservation: the 4-week series (4 sessions)
    await openFreeSlot()
    await player.chooseRepeatWeeks(WEEKS)
    await player.advanceToBookingSummary()
    await player.submitBooking()

    // 2nd active reservation: one single booking is still allowed (limit = 2)
    await openFreeSlot()
    await player.confirmBooking()

    await player.goToReservations()
    await player.selectTab('upcoming')
    await expect(player.upcomingBookedRows()).toHaveCount(WEEKS + 1)

    // A 3rd active reservation exceeds the limit: error toast, modal stays open
    await openFreeSlot()
    await player.advanceToBookingSummary()
    await page.getByTestId('booking-confirm').click()
    await expect(player.toast('error')).toBeVisible()
    await expect(page.getByTestId('booking-modal')).toBeVisible()

    // Nothing new was booked
    await player.closeBookingModal()
    await player.goToReservations()
    await player.selectTab('upcoming')
    await expect(player.upcomingBookedRows()).toHaveCount(WEEKS + 1)
  })
})
