import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 16 — Admin Settings: validation errors, "Discard changes" and persistence
 *
 * Complements E2E 10 (price change). Validation rules come from `settingsSchema`
 * in club-store; the form is `noValidate`, so errors are rendered by the app
 * (`setting-error-<key>`) and nothing is saved while any field is invalid.
 * Defaults (seed): openHour 7, closeHour 22, peakStart 18:00, peakEnd 21:00,
 * maxActiveReservations 2.
 */
test.describe('Admin · Settings', () => {
  let admin: AdminPage

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page)
    await page.goto(adminUrl('', { seed: 'demo' }))
    await admin.goToSettings()
  })

  test('closing hour must be after opening hour', async ({ page }) => {
    await admin.setSetting('openHour', '12')
    await admin.setSetting('closeHour', '10')
    await page.getByTestId('settings-save').click()

    await expect(page.getByTestId('setting-error-closeHour')).toHaveText('Closing hour must be after opening hour')
    await expect(page.getByTestId('setting-closeHour')).toHaveAttribute('aria-invalid', 'true')
    await expect(admin.toast('Settings saved')).toHaveCount(0)
  })

  test('peak end must be after peak start', async ({ page }) => {
    await admin.setSetting('peakEnd', '17:00') // peakStart defaults to 18:00
    await page.getByTestId('settings-save').click()

    await expect(page.getByTestId('setting-error-peakEnd')).toHaveText('Peak end must be after peak start')
    await expect(admin.toast('Settings saved')).toHaveCount(0)
  })

  test('an empty numeric field is rejected and only that field is flagged', async ({ page }) => {
    await admin.setSetting('basePrice', '')
    await page.getByTestId('settings-save').click()

    await expect(page.getByTestId('setting-error-basePrice')).toBeVisible()
    await expect(page.getByTestId('setting-basePrice')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('setting-peakPrice')).toHaveAttribute('aria-invalid', 'false')
    await expect(admin.toast('Settings saved')).toHaveCount(0)
  })

  test('fixing an invalid value and saving again clears the error and saves', async ({ page }) => {
    await admin.setSetting('closeHour', '5') // openHour is 7 → invalid
    await page.getByTestId('settings-save').click()
    await expect(page.getByTestId('setting-error-closeHour')).toBeVisible()

    await admin.setSetting('closeHour', '23')
    await admin.saveSettings() // waits for the "Settings saved" toast
    await expect(page.getByTestId('setting-error-closeHour')).toHaveCount(0)
  })

  test('"Discard changes" restores the saved values and clears errors', async ({ page }) => {
    await admin.setSetting('maxActiveReservations', '5')
    await admin.setSetting('closeHour', '1') // invalid → error shown
    await page.getByTestId('settings-save').click()
    await expect(page.getByTestId('setting-error-closeHour')).toBeVisible()

    await page.getByTestId('settings-reset').click()

    await expect(page.getByTestId('setting-maxActiveReservations')).toHaveValue('2')
    await expect(page.getByTestId('setting-closeHour')).toHaveValue('22')
    await expect(page.getByTestId('setting-error-closeHour')).toHaveCount(0)
  })

  test('saved settings persist after leaving and returning to Settings', async ({ page }) => {
    await admin.setSetting('maxActiveReservations', '3')
    await admin.setSetting('cancelHoursLimit', '6')
    await admin.saveSettings()

    await admin.goToUsers()
    await admin.goToSettings()

    await expect(page.getByTestId('setting-maxActiveReservations')).toHaveValue('3')
    await expect(page.getByTestId('setting-cancelHoursLimit')).toHaveValue('6')
  })
})
