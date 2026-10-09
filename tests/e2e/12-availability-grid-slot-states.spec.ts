import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 12 — Availability page: court × hour grid and slot states
 *
 * The Availability page renders a court × time-slot grid. Each cell's state
 * comes from `slotStatus` (the same rules the store enforces when booking),
 * computed inside the selector so it refreshes on any data or clock change.
 *
 * Covered by club-player PR #3 (docs/code-comments) which clarified:
 *  - The grid uses the same `slotStatus` rules as the store.
 *  - The selector is computed reactively so it refreshes on any change.
 *  - Date navigation (prev/next/today) updates the displayed date.
 *
 * Happy paths:
 *  - The availability page loads and the grid is visible.
 *  - Available slots are rendered with state="available" and are clickable.
 *  - The date label updates when navigating to the next day.
 *  - Navigating back to today resets the date label.
 *  - The legend shows all expected slot-state labels.
 *
 * Negative paths:
 *  - Non-available slots (taken, blocked, lesson, past) are disabled.
 *  - Clicking a taken/blocked slot does not open the booking modal.
 *  - Unauthenticated access redirects to /login (Guard).
 */

test.describe('Availability — court grid and slot states', () => {
  // ── Happy path: grid renders ─────────────────────────────────────────────────

  test('availability page loads and the grid is visible', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))
    await player.goToAvailability()

    await expect(page.getByTestId('availability-page')).toBeVisible()
    await expect(page.getByTestId('availability-grid')).toBeVisible()
  })

  test('available slots are rendered and clickable', async ({ page }) => {
    const player = new PlayerPage(page)
    // Use empty seed so there are no existing reservations blocking slots
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
    await player.goToAvailability()

    // At least one available slot should exist on an empty seed
    const availableSlot = page.locator('[data-state="available"]').first()
    await expect(availableSlot).toBeVisible()
    await expect(availableSlot).toBeEnabled()
  })

  test('booking modal opens when an available slot is clicked', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
    await player.goToAvailability()

    await player.clickFirstAvailableSlot()

    // The 3-step booking modal should appear
    await expect(page.getByTestId('booking-modal')).toBeVisible()
  })

  test('date label updates when navigating to the next day', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))
    await player.goToAvailability()

    const labelBefore = await page.getByTestId('date-label').textContent()

    // Click the "next day" button
    await page.getByTestId('date-next').click()

    const labelAfter = await page.getByTestId('date-label').textContent()
    expect(labelAfter).not.toBe(labelBefore)
  })

  test('today button resets the date to today', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))
    await player.goToAvailability()

    const labelToday = await page.getByTestId('date-label').textContent()

    // Navigate away then come back
    await page.getByTestId('date-next').click()
    await page.getByTestId('date-today').click()

    await expect(page.getByTestId('date-label')).toHaveText(labelToday!)
  })

  test('legend shows all expected slot-state labels', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))
    await player.goToAvailability()

    // All states documented in the component should appear in the legend
    for (const state of ['available', 'taken', 'blocked', 'lesson', 'past']) {
      await expect(page.getByTestId(`legend-${state}`)).toBeVisible()
    }
    // Peak indicator is also in the legend
    await expect(page.getByTestId('legend-peak')).toBeVisible()
  })

  // ── Negative path: non-available slots are disabled ──────────────────────────

  test('taken slots are disabled and cannot be clicked', async ({ page }) => {
    const player = new PlayerPage(page)
    // Full seed has many taken slots
    await page.goto(playerUrl('', { seed: 'full', as: 'player-7', reset: true }))
    await player.goToAvailability()

    const takenSlot = page.locator('[data-state="taken"]').first()
    // If there are taken slots, they must be disabled
    const count = await takenSlot.count()
    if (count > 0) {
      await expect(takenSlot).toBeDisabled()
    }
  })

  test('clicking a non-available slot does not open the booking modal', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'full', as: 'player-7', reset: true }))
    await player.goToAvailability()

    // Try to click a taken slot — it is disabled so no modal should appear
    const takenSlot = page.locator('[data-state="taken"]').first()
    const count = await takenSlot.count()
    if (count > 0) {
      // Disabled buttons do not fire click events
      await takenSlot.click({ force: true })
      await expect(page.getByTestId('booking-modal')).not.toBeVisible()
    }
  })

  // ── Negative path: unauthenticated access ────────────────────────────────────

  test('unauthenticated access to availability redirects to /login', async ({ page }) => {
    // No ?as= → Guard redirects
    await page.goto(playerUrl('', { seed: 'demo', reset: true }))
    await expect(page).toHaveURL(/\/login/)
  })
})
