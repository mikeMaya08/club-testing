import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { PlayerPage } from '../pages/PlayerPage'
import { coachUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 05 — Player enrolls in a lesson → Coach sees updated student count
 *
 * The demo seed already has three upcoming lessons (lesson-1, lesson-2,
 * lesson-3). lesson-1 "Beginner Drills" has 2 students enrolled (player-1,
 * player-2) with capacity 4 — so player-5 can still join.
 *
 * Journey:
 *  1. Coach (coach-1) opens the lesson detail for lesson-1 and records
 *     the current enrolled count.
 *  2. Player-5 (Camila Ortiz) opens the Lessons page and enrolls
 *     in "Beginner Drills".
 *  3. Coach revisits the lesson detail page and verifies the enrolled count
 *     has incremented by 1 and that Camila Ortiz appears in the student list.
 */
test('player enrolment is reflected in the coach lesson detail', async ({ page }) => {
  const coach = new CoachPage(page)

  // ── Step 1: Coach reads the initial enrolled count ─────────────────────────
  await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))

  // Navigate to lesson-1 via the schedule
  await page.getByText('Beginner Drills').first().click()
  await expect(page.getByRole('heading', { name: 'Beginner Drills' })).toBeVisible()

  // lesson-1 starts with 2 students enrolled out of 4
  await expect(page.getByText('Enrolled: 2 of 4')).toBeVisible()

  // ── Step 2: Player-5 (Camila Ortiz) enrolls ───────────────────────────────
  const player = new PlayerPage(page)

  // Preserve state — no reset
  await page.goto(playerUrl('lessons', { as: 'player-5', reset: false }))

  await expect(page.getByTestId('lessons-page')).toBeVisible()

  // Find lesson-1 card and enrol
  await player.enrollInLesson('lesson-1')

  // The enrol button should now be a "Leave" button
  await expect(page.getByTestId('lesson-leave-lesson-1')).toBeVisible()

  // ── Step 3: Coach sees the incremented count ───────────────────────────────
  await page.goto(coachUrl('lessons/lesson-1', { as: 'coach-1', reset: false }))

  await expect(page.getByText('Enrolled: 3 of 4')).toBeVisible()
  await expect(page.getByText('Camila Ortiz')).toBeVisible()
})
