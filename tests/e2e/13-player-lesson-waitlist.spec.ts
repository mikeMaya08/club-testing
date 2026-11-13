import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 13 — Player lesson waitlist
 *
 * Demo seed: lesson-3 "Advanced Rallies" has capacity 3 and is full
 * (player-6, player-7, player-8). player-10 is already #1 on its waitlist.
 *
 * All steps run inside the Player app (same origin → shared localStorage),
 * so we can act as several club members by switching the `as` hook without
 * resetting the data.
 */
test.describe('player lessons: waitlist', () => {
  test('a player joins the waitlist of a full lesson and then leaves it', async ({ page }) => {
    const player = new PlayerPage(page)

    // player-9 opens the Lessons page on a fresh demo seed
    await page.goto(playerUrl('lessons', { as: 'player-9', reset: true }))
    await expect(page.getByTestId('lessons-page')).toBeVisible()

    // The lesson is full: no way to enroll directly
    await expect(player.lessonSeatsLeft('lesson-3')).toHaveText('Full')
    await expect(page.getByTestId('lesson-enroll-lesson-3')).toBeDisabled()

    // Join the waitlist: player-10 is already #1, so player-9 is #2
    await player.joinWaitlist('lesson-3')
    await expect(page.getByText('You are on the waitlist')).toBeVisible()
    await expect(player.waitlistPosition('lesson-3')).toContainText('You are #2 on the waitlist')

    // Change of plans: leave the waitlist and get the "Join waitlist" option back
    await player.leaveWaitlist('lesson-3')
    await expect(page.getByTestId('lesson-waitlist-join-lesson-3')).toBeVisible()
  })

  test('the first waitlisted player is enrolled automatically when an enrolled player leaves', async ({ page }) => {
    const player = new PlayerPage(page)

    // ── player-9 joins the waitlist behind player-10 ─────────────────────────
    await page.goto(playerUrl('lessons', { as: 'player-9', reset: true }))
    await player.joinWaitlist('lesson-3')
    await expect(player.waitlistPosition('lesson-3')).toContainText('#2')

    // ── player-6 (enrolled) gives up their seat ──────────────────────────────
    await page.goto(playerUrl('lessons', { as: 'player-6' }))
    await expect(page.getByTestId('lessons-page')).toBeVisible()
    await player.leaveLesson('lesson-3')
    await expect(page.getByText('You left the lesson')).toBeVisible()

    // ── player-10 (#1 in line) now holds the seat and was notified ───────────
    await page.goto(playerUrl('lessons', { as: 'player-10' }))
    await expect(page.getByTestId('lesson-leave-lesson-3')).toBeVisible()
    await expect(player.waitlistPosition('lesson-3')).toHaveCount(0)

    await player.openNotifications()
    await expect(
      player.notificationWithText('A seat opened up: you are now enrolled in Advanced Rallies.'),
    ).toBeVisible()

    // ── player-9 moved up to #1 and the lesson is full again ─────────────────
    await page.goto(playerUrl('lessons', { as: 'player-9' }))
    await expect(player.waitlistPosition('lesson-3')).toContainText('You are #1 on the waitlist')
    await expect(player.lessonSeatsLeft('lesson-3')).toHaveText('Full')
  })
})
