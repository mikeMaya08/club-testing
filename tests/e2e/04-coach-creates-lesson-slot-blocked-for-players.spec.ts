import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { PlayerPage } from '../pages/PlayerPage'
import { coachUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 04 — Coach creates a lesson → slot becomes unavailable for players
 *
 * Journey:
 *  1. Coach (coach-1 / Carlos Coach) logs in and creates a new lesson on
 *     Court 2 for the day after the fixed "now" (2026-10-11) at 14:00–15:00.
 *  2. The form shows the "This slot is free" banner and submits successfully,
 *     redirecting to the lesson detail page.
 *  3. A player (player-3) opens the Availability page for the same date and
 *     confirms that the 14:00 slot on Court 2 now shows state "lesson" (not "available").
 */
test('coach creates lesson and slot is blocked for players', async ({ page }) => {
  const coach = new CoachPage(page)

  // ── Step 1: Coach logs in and goes straight to the Create Lesson page ──────
  // Navigate directly to /coach/create to avoid fragile nav-link clicks
  await page.goto(coachUrl('create', { seed: 'empty', as: 'coach-1', reset: true }))

  // ── Step 2: Create the lesson ──────────────────────────────────────────────
  // Court 2 is a hard court with lights — safe for a 14:00 slot
  await coach.createLesson({
    title: 'Test Serve Clinic',
    courtName: 'Court 2',
    date: '2026-10-11',  // one day after FIXED_NOW
    start: '14:00',
    end: '15:00',
    capacity: 4,
  })

  // Lesson detail page is shown with the lesson title
  await expect(page.getByRole('heading', { name: 'Test Serve Clinic' })).toBeVisible()
  await expect(page.getByText('Enrolled: 0 of 4')).toBeVisible()

  // ── Step 3: Player sees the slot as "lesson" in the availability grid ──────
  const player = new PlayerPage(page)

  await page.goto(playerUrl('', { as: 'player-3', reset: false }))
  await player.goToAvailability()

  // Navigate to the lesson date
  await page.getByTestId('date-input').fill('2026-10-11')

  // court-2 at 14:00 — data-testid="slot-court-2-14:00"
  const lessonSlot = page.getByTestId('slot-court-2-14:00')
  await expect(lessonSlot).toBeVisible()
  await expect(lessonSlot).toHaveAttribute('data-state', 'lesson')
  await expect(lessonSlot).toBeDisabled()
})
