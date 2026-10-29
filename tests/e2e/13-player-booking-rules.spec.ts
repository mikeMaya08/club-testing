import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 13 — Booking rules seen by the player.
 * Clock is fixed at 2026-10-10 10:00, so every slot from 11:00 on is bookable today.
 * Empty seed: no reservations, blocks or lessons, so results don't depend on seeded data.
 */
test.describe('player booking rules', () => {
  test('second player is told the slot is gone when it was booked meanwhile', async ({ page, context }) => {
    const playerA = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
    await playerA.goToAvailability()

    // Player A opens the slot and keeps the booking modal open (stale intent)
    await playerA.openSlot('court-1', '14:00')

    // Player B (another tab, same browser origin) books that same slot first
    const pageB = await context.newPage()
    const playerB = new PlayerPage(pageB)
    await pageB.goto(playerUrl('', { seed: 'empty', as: 'player-2' }))
    await playerB.goToAvailability()
    await playerB.openSlot('court-1', '14:00')
    await playerB.confirmBooking()

    // Player A now confirms: the rule engine rejects it with SLOT_TAKEN
    await playerA.advanceToSummary()
    await page.getByTestId('booking-confirm').click()
    await expect(playerA.errorToast()).toContainText('That slot is no longer available.')
    await expect(page.getByTestId('booking-modal')).toBeHidden()
    await expect(playerA.slot('court-1', '14:00')).toHaveAttribute('data-state', 'taken')

    // ...and nothing was booked for player A
    await playerA.goToReservations()
    await playerA.selectTab('upcoming')
    await expect(page.getByTestId('upcoming-empty')).toBeVisible()
  })

  test('courts without lights and closed courts cannot be booked in the evening', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
    await player.goToAvailability()

    // lightsRequiredFrom is 19:00: Court 5 has no lights
    await expect(player.slot('court-5', '18:00')).toHaveAttribute('data-state', 'available')
    await expect(player.slot('court-5', '19:00')).toHaveAttribute('data-state', 'no-lights')
    await expect(player.slot('court-5', '19:00')).toBeDisabled()
    // Same hour on a court with lights stays bookable
    await expect(player.slot('court-1', '19:00')).toHaveAttribute('data-state', 'available')
    // Court 4 is out of service
    await expect(player.slot('court-4', '14:00')).toHaveAttribute('data-state', 'inactive')
    await expect(player.slot('court-4', '14:00')).toBeDisabled()
  })

  // Default prices: base 250 MXN, peak 400 MXN (peak = 18:00–21:00, surcharge +150)
  const cases = [
    { label: 'off-peak', start: '14:00', price: '250 MXN', surcharge: null },
    { label: 'peak', start: '18:00', price: '400 MXN', surcharge: '+150 MXN' },
  ]
  for (const c of cases) {
    test(`charged price matches the summary: ${c.label} slot`, async ({ page }) => {
      const player = new PlayerPage(page)
      await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
      await player.goToAvailability()

      await player.openSlot('court-1', c.start)
      await player.advanceToSummary()
      await expect(page.getByTestId('summary-total')).toHaveText(c.price)
      if (c.surcharge) await expect(page.getByTestId('summary-peak')).toHaveText(c.surcharge)
      await page.getByTestId('booking-confirm').click()
      await expect(page.getByTestId('booking-modal')).toBeHidden()

      // The price stored on the reservation must equal what the summary showed
      await player.goToReservations()
      await player.selectTab('upcoming')
      await expect(page.getByTestId(/^reservation-price-/)).toHaveText(c.price)
    })
  }
})
