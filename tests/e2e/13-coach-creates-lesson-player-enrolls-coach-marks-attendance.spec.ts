import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { PlayerPage } from '../pages/PlayerPage'
import { coachUrl, playerUrl } from '../helpers/urls'
import { readClubState, writeClubState } from '../helpers/shared-state'

/**
 * E2E 13 — Coach creates a lesson → Player enrolls → Coach marks attendance
 *
 * Uses the `empty` seed (users and courts only) so the journey is fully
 * deterministic: the only lesson in the club is the one created here.
 * Clock is frozen by the URL helpers (FIXED_NOW = 2026-10-10T10:00).
 *
 * The coach and player apps live on different origins, so the club state
 * (localStorage['club:v1']) is carried from one app to the next with
 * tests/helpers/shared-state.ts.
 *
 * Journey:
 *  1. Coach-1 opens Create lesson from the nav, creates a 3-seat lesson on
 *     Court 2 (2026-10-11, 15:00–16:00) and lands on its detail (0 enrolled).
 *  2. Player-5 (Camila Ortiz) opens Lessons, sees "3 seats left", enrolls and
 *     sees "2 seats left" with a Leave button.
 *  3. Coach-1 opens the lesson from the schedule, sees "Enrolled: 1 of 3" with
 *     Camila Ortiz listed, marks her Present and the attendance persists.
 */
test('coach creates a lesson, player enrolls, coach marks attendance', async ({ page }) => {
  const coach = new CoachPage(page)
  const player = new PlayerPage(page)

  const lesson = {
    title: 'E2E Serve Clinic',
    courtName: 'Court 2',
    date: '2026-10-11', // day after the frozen clock; visible on the coach schedule (see E2E 05)
    start: '15:00',
    end: '16:00',
    capacity: 3,
  }
  const studentName = 'Camila Ortiz' // player-5 in the seed (same user as E2E 05)

  // ── Step 1: Coach creates the lesson ───────────────────────────────────────
  await page.goto(coachUrl('', { seed: 'empty', as: 'coach-1', reset: true }))
  await coach.goToCreateLesson()
  await coach.createLessonFromForm(lesson)

  await expect(coach.lessonHeading(lesson.title)).toBeVisible()
  await expect(coach.enrolledCount()).toHaveText(`Enrolled: 0 of ${lesson.capacity}`)
  await expect(page.getByText('No students enrolled yet.')).toBeVisible()

  // Carry the state (including the new lesson) over to the player app
  const stateAfterCreate = await readClubState(page)

  // ── Step 2: Player enrolls in the new lesson ───────────────────────────────
  await page.goto(playerUrl('', { seed: 'empty', as: 'player-5', reset: false }))
  await writeClubState(page, stateAfterCreate)
  await player.goToLessons()

  await expect(player.lessonCardByTitle(lesson.title)).toBeVisible()
  await expect(player.lessonCardSeats(lesson.title)).toHaveText('3 seats left')

  await player.enrollInLessonByTitle(lesson.title)
  await expect(player.lessonCardSeats(lesson.title)).toHaveText('2 seats left')

  // Carry the state (including the enrolment) back to the coach app
  const stateAfterEnrol = await readClubState(page)

  // ── Step 3: Coach sees the student and marks attendance ────────────────────
  await page.goto(coachUrl('', { seed: 'empty', as: 'coach-1', reset: false }))
  await writeClubState(page, stateAfterEnrol)
  await coach.openLessonFromSchedule(lesson.title)

  await expect(coach.enrolledCount()).toHaveText(`Enrolled: 1 of ${lesson.capacity}`)
  await expect(coach.studentRow(studentName)).toBeVisible()

  await coach.markAttendance(studentName, 'present')
  await expect(page.getByText('Marked present')).toBeVisible()
  await expect(coach.attendanceButton(studentName, 'no-show')).toHaveAttribute('aria-pressed', 'false')

  // Attendance is persisted: still Present after a reload
  await page.reload()
  await expect(coach.attendanceButton(studentName, 'present')).toHaveAttribute('aria-pressed', 'true')
})
