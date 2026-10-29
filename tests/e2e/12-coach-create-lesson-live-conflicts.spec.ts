import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { coachUrl } from '../helpers/urls'

/**
 * E2E 12 — Create-lesson form validates live, before submitting.
 *
 * Fixed clock is 2026-10-10 10:00, so on the demo seed:
 *  - 2026-10-11: lesson-1 "Beginner Drills" on Court 1, 17:00–18:00
 *  - 2026-10-11: Court 2 maintenance block, 08:00–10:00
 *  - Court 5 has no lights (required from 19:00); Court 4 is closed
 *  - club is open 7:00–22:00
 * 2026-11-16 is outside the seeded activity window, so it has no conflicts.
 */
test.describe('create lesson: live conflict feedback', () => {
  let coach: CoachPage

  test.beforeEach(async ({ page }) => {
    coach = new CoachPage(page)
    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))
    await coach.goToCreateLesson()
  })

  test('overlapping another lesson is reported', async () => {
    await coach.chooseCourt('Court 1')
    await coach.fillSchedule({ date: '2026-10-11', start: '17:30', end: '18:30' })
    await expect(coach.conflictAlert()).toContainText('Another lesson ("Beginner Drills") runs 17:00–18:00.')
    await expect(coach.slotFreeBanner()).toBeHidden()
  })

  test('a maintenance block is reported', async () => {
    await coach.chooseCourt('Court 2')
    await coach.fillSchedule({ date: '2026-10-11', start: '09:00', end: '10:00' })
    await expect(coach.conflictAlert()).toContainText('Court blocked for maintenance, 08:00–10:00.')
  })

  test('a court without lights is rejected from 19:00', async () => {
    await coach.chooseCourt('Court 5')
    await coach.fillSchedule({ date: '2026-11-16', start: '19:00', end: '20:00' })
    await expect(coach.conflictAlert()).toContainText('Court 5 has no lights, so it cannot be used from 19:00.')
  })

  test('an end time before the start time is rejected', async () => {
    await coach.chooseCourt('Court 1')
    await coach.fillSchedule({ date: '2026-11-16', start: '11:00', end: '10:00' })
    await expect(coach.conflictAlert()).toContainText('The end time must be after the start time.')
  })

  test('a slot outside opening hours is rejected', async () => {
    await coach.chooseCourt('Court 1')
    await coach.fillSchedule({ date: '2026-11-16', start: '06:00', end: '07:00' })
    await expect(coach.conflictAlert()).toContainText('The club is open 7:00 to 22:00.')
  })

  test('the warning clears when the coach picks a free slot', async () => {
    await coach.chooseCourt('Court 1')
    await coach.fillSchedule({ date: '2026-10-11', start: '17:30', end: '18:30' })
    await expect(coach.conflictAlert()).toBeVisible()

    await coach.dateInput().fill('2026-11-16')
    await expect(coach.conflictAlert()).toBeHidden()
    await expect(coach.slotFreeBanner()).toBeVisible()
  })

  test('a closed court cannot be selected', async ({ page }) => {
    await coach.courtSelect().click()
    await expect(page.getByRole('option', { name: 'Court 4' })).toHaveAttribute('aria-disabled', 'true')
  })
})
