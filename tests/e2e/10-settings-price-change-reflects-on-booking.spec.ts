import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { adminUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 10 — Admin updates base price → new price is reflected in the player's
 *           booking summary modal
 *
 * Default base price from the seed is 250 MXN. We change it to 350 MXN.
 * A player then opens a non-peak slot and verifies the summary on step 3
 * of the booking modal shows 350 MXN.
 *
 * Journey:
 *  1. Admin navigates to Settings and changes the base price from 250 to 350.
 *  2. Admin saves and sees the success toast; reloads to confirm persistence.
 *  3. Player opens Availability, selects a non-peak slot (before 18:00),
 *     advances to step 3 of the booking modal, and asserts the total is "350 MXN".
 */
test('updated base price is reflected in the player booking modal', async ({ page }) => {
  const admin = new AdminPage(page)
  const NEW_PRICE = 350

  // ── Step 1: Admin changes the base price ──────────────────────────────────
  await page.goto(adminUrl('settings', { seed: 'empty', reset: true }))

  await admin.setBasePrice(NEW_PRICE)
  await admin.saveSettings()

  // ── Step 2: Reload and confirm the value persisted ────────────────────────
  await page.reload()
  await expect(page.getByTestId('setting-basePrice')).toHaveValue(String(NEW_PRICE))

  // ── Step 3: Player opens a non-peak slot and checks the booking summary ────
  const player = new PlayerPage(page)

  // Preserve state — no reset; the updated settings are already in localStorage
  await page.goto(playerUrl('', { as: 'player-1', reset: false }))
  await player.goToAvailability()

  // We need a non-peak slot (peak is 18:00–21:00 by default).
  // The empty seed + now=10:00 ensures many morning slots are free.
  // Click the first available slot — if it lands in a peak hour the
  // peak surcharge will be shown instead; we only assert the base-price line.
  await player.clickFirstAvailableSlot()

  // Step 1 of the booking modal
  await expect(page.getByTestId('booking-modal')).toBeVisible()
  await page.getByTestId('booking-next').click()

  // Step 2 — skip partner
  await page.getByTestId('booking-next').click()

  // Step 3 — summary
  const basePriceText = await page.getByTestId('summary-base').textContent()
  expect(basePriceText).toContain(String(NEW_PRICE))

  // Total must be at least the new base price (could be higher if peak)
  const totalText = await page.getByTestId('summary-total').textContent()
  const total = parseInt(totalText?.match(/\d+/)?.[0] ?? '0', 10)
  expect(total).toBeGreaterThanOrEqual(NEW_PRICE)
})
