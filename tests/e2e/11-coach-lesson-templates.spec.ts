import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { coachUrl } from '../helpers/urls'

/**
 * E2E 11 — Coach lesson templates (save, apply, delete)
 *
 * Demo seed gives coach-1 two templates:
 *  - "Beginner evening"    (17:00–18:00, 4 seats)
 *  - "Morning serve work"  (Court 3, 09:00–10:30, 6 seats, title "Serve Clinic")
 */
test.describe('coach lesson templates', () => {
  test('coach starts a lesson from a saved template', async ({ page }) => {
    const coach = new CoachPage(page)
    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))
    await coach.goToCreateLesson()

    // Applying the template fills the form with its stored values
    await coach.chooseTemplate('Morning serve work')
    await expect(coach.titleInput()).toHaveValue('Serve Clinic')
    await expect(coach.courtSelect()).toContainText('Court 3')
    await expect(coach.startInput()).toHaveValue('09:00')
    await expect(coach.endInput()).toHaveValue('10:30')
    await expect(coach.capacityInput()).toHaveValue('6')

    // A date well outside the seeded ±7-day activity window, so the slot is free
    await coach.dateInput().fill('2026-11-16')
    await expect(coach.slotFreeBanner()).toBeVisible()

    await page.getByRole('button', { name: 'Create lesson' }).click()
    await expect(page).toHaveURL(/\/lessons\/lesson-/)
    await expect(page.getByRole('heading', { name: 'Serve Clinic' })).toBeVisible()
    await expect(page.getByText('Enrolled: 0 of 6')).toBeVisible()
  })

  test('coach saves the create-lesson form as a template', async ({ page }) => {
    const coach = new CoachPage(page)
    await page.goto(coachUrl('', { seed: 'empty', as: 'coach-1', reset: true }))
    await coach.goToCreateLesson()
    await expect(page.getByText('No templates yet.')).toBeVisible()

    await coach.titleInput().fill('Smash Practice')
    await coach.chooseCourt('Court 2')
    await coach.startInput().fill('09:00')
    await coach.endInput().fill('10:00')
    await coach.capacityInput().fill('5')
    await coach.saveAsTemplate('Smash morning')

    const row = coach.templateRow('Smash morning')
    await expect(row).toBeVisible()
    await expect(row).toContainText('Smash Practice · 09:00–10:00 · 5 seats')
    await expect(page.getByText('No templates yet.')).toBeHidden()
    // "Start from a template" is now offered
    await expect(coach.templateSelect()).toBeVisible()
  })

  test('coach deletes a template and keeps the others', async ({ page }) => {
    const coach = new CoachPage(page)
    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))
    await coach.goToCreateLesson()

    await coach.deleteTemplate('Beginner evening')
    await expect(coach.templateRow('Beginner evening')).toBeHidden()
    await expect(coach.templateRow('Morning serve work')).toBeVisible()
  })
})
