import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 14 — Courts with upcoming activity can't be deleted.
 * Demo seed: lesson-1 ("Beginner Drills") is scheduled tomorrow on Court 1;
 * Court 4 is closed and has no lessons or reservations.
 */
test.describe('admin deletes courts', () => {
  test('a court with a scheduled lesson is kept and an error is shown', async ({ page }) => {
    const admin = new AdminPage(page)
    await page.goto(adminUrl('courts', { seed: 'demo', reset: true }))
    await expect(admin.courtRow('court-1')).toBeVisible()

    await admin.deleteCourt('court-1')

    await expect(admin.toast('error')).toContainText('This court still has upcoming reservations or lessons.')
    await expect(admin.courtRow('court-1')).toBeVisible()
  })

  test('a court with nothing scheduled is deleted', async ({ page }) => {
    const admin = new AdminPage(page)
    await page.goto(adminUrl('courts', { seed: 'demo', reset: true }))

    await admin.deleteCourt('court-4')

    await expect(admin.toast('success')).toContainText('Court deleted')
    await expect(admin.courtRow('court-4')).toHaveCount(0)
    // Other courts are untouched
    await expect(admin.courtRow('court-1')).toBeVisible()
  })
})
