import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 15 — Player reads the notes their coaches left
 *
 * Demo seed: player-1 (Lucía Fernández) has two notes from coach-1
 * (Carlos Coach): note-1 "Great footwork today..." (newest) and
 * note-6 "Ready to move up a level.". player-12 has none.
 *
 * Note: the Coach and Player apps run on different origins, so a note written
 * in the Coach app is not visible here; this spec verifies the Player side
 * against seeded data.
 */
test.describe('player: my notes', () => {
  test('a player sees the notes coaches left, newest first', async ({ page }) => {
    const player = new PlayerPage(page)

    await page.goto(playerUrl('', { as: 'player-1', reset: true }))
    await player.goToNotes()

    await expect(page.getByTestId('note-coach-note-1')).toHaveText('Carlos Coach')
    await expect(page.getByTestId('note-text-note-1')).toContainText('Great footwork today')
    await expect(page.getByTestId('note-text-note-6')).toContainText('Ready to move up a level.')

    // Newest note (note-1, 2 days ago) is listed before note-6 (4 days ago)
    const notes = page.locator('[data-testid^="note-note-"], li[data-testid^="note-"]')
    await expect(notes.first()).toHaveAttribute('data-testid', 'note-note-1'.replace('note-note', 'note'))
    await expect(page.getByTestId('notes-empty')).toHaveCount(0)
  })

  test('a player with no notes sees the empty state', async ({ page }) => {
    const player = new PlayerPage(page)

    await page.goto(playerUrl('', { as: 'player-12', reset: true }))
    await player.goToNotes()

    await expect(page.getByTestId('notes-empty')).toHaveText('Your coaches have not left any notes yet.')
  })
})
