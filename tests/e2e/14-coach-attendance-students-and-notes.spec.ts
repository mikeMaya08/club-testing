import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { coachUrl } from '../helpers/urls'

/**
 * E2E 14 — Coach follow-up after a lesson: attendance → roster → note
 *
 * Demo seed (clock fixed at FIXED_NOW):
 *  - lesson-4 "Footwork Basics" is done; player-1 (Lucía Fernández) and
 *    player-2 (Mateo Rojas) were present → each already has 1 attended lesson.
 *  - lesson-1 "Beginner Drills" is scheduled with player-1 and player-2 enrolled.
 *
 * The Students page only lists players who were marked present in the coach's
 * lessons, with a link to write a note for each one.
 */
test.describe('coach: attendance, students and notes', () => {
  test('marking a student present updates the roster and lets the coach save a note', async ({ page }) => {
    const coach = new CoachPage(page)
    const noteText = 'Good toss on the serve, keep working on recovery.'

    // ── Coach opens the schedule and the Beginner Drills lesson ──────────────
    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))
    await page.getByText('Beginner Drills').first().click()
    await expect(page.getByRole('heading', { name: 'Beginner Drills' })).toBeVisible()

    // ── Mark Lucía present ───────────────────────────────────────────────────
    await coach.markAttendance('Lucía Fernández', 'present')

    // ── Students roster now counts 2 attended lessons for her (lesson-4 + lesson-1)
    await coach.goToStudents()
    await expect(page.getByText('2 lessons attended')).toBeVisible()

    // ── "Add note" opens the editor with the student preselected ─────────────
    await coach.rosterRow('Lucía Fernández').getByRole('link', { name: 'Add note' }).click()
    await expect(page).toHaveURL(/\/coach\/notes\?student=player-1/)
    await expect(coach.studentSelect()).toContainText('Lucía Fernández')

    // Nothing to save until the coach writes something
    await expect(coach.saveNoteButton()).toBeDisabled()
    await coach.writeNote(noteText)
    await coach.rate(4)
    await coach.saveNoteButton().click()

    // ── Note is saved, the editor resets and the note shows in the history ───
    await expect(page.getByText('Note saved')).toBeVisible()
    await expect(coach.noteEditor()).toHaveText('')
    await expect(page.getByText(noteText)).toBeVisible()
  })

  test('a note cannot be saved without a rating, then saves once rated', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))
    await coach.goToStudentNotes()

    await coach.chooseStudent('Mateo Rojas')
    await coach.writeNote('Needs to recover faster after the forehand.')

    // No rating selected → validation message, note is kept in the editor
    await coach.saveNoteButton().click()
    await expect(page.getByText('Please choose a rating')).toBeVisible()
    await expect(coach.noteEditor()).toContainText('Needs to recover faster')

    // Rate and save
    await coach.rate(3)
    await coach.saveNoteButton().click()
    await expect(page.getByText('Note saved')).toBeVisible()
  })
})
