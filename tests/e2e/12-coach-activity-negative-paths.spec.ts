import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { coachUrl } from '../helpers/urls'

/**
 * E2E 12 — Coach Activity page — negative paths & edge cases
 *
 * Covers error states, empty data, boundary conditions, and actor-recording
 * behaviour introduced in club-coach PR #2 (feat/activity-log):
 *
 *  - Empty state: a coach with no relevant events sees "No activity yet."
 *  - Filter isolation: switching filters resets the visible count to PAGE (15)
 *    so stale "Show more" state from a previous filter does not bleed through.
 *  - Unauthenticated access: navigating to /coach/activity without a session
 *    redirects to the login page (Guard component).
 *  - Coach isolation: coach-2 does NOT see events that belong exclusively to
 *    coach-1's lessons.
 *  - Attendance actor recording: marking a student as no-show from the lesson
 *    detail page now passes me.id to api.setAttendance — the resulting event
 *    appears in the coach's Activity feed under "My lessons".
 *  - Mark-as-done actor recording: completing a lesson passes me.id to
 *    api.completeLesson — the resulting event appears in the Activity feed.
 */

test.describe('Activity page — negative paths & edge cases', () => {
  test('empty state is shown when the coach has no relevant events', async ({ page }) => {
    const coach = new CoachPage(page)

    // The "empty" seed has no events at all, so the Activity list must be empty
    await page.goto(coachUrl('activity', { seed: 'empty', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    await expect(coach.emptyState()).toBeVisible()
    // The ordered list should contain no items
    await expect(coach.activityList().locator('li').first()).not.toBeVisible()
  })

  test('"My lessons" filter shows empty state when coach has no lesson/attendance events', async ({ page }) => {
    const coach = new CoachPage(page)

    // Empty seed: no events of any type
    await page.goto(coachUrl('activity', { seed: 'empty', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    await coach.selectActivityFilter('My lessons')

    // With no events the empty state must still be visible
    await expect(coach.emptyState()).toBeVisible()
  })

  test('"Notes and templates" filter shows empty state when no note/template events exist', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'empty', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    await coach.selectActivityFilter('Notes and templates')

    await expect(coach.emptyState()).toBeVisible()
  })

  test('switching filters resets visible count so stale Show-more state does not bleed', async ({ page }) => {
    const coach = new CoachPage(page)

    // Use the full seed to maximise the chance of having >15 events
    await page.goto(coachUrl('activity', { seed: 'full', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // If "Show more" is present, click it to expand the list
    const showMore = coach.showMoreButton()
    if (await showMore.isVisible()) {
      await showMore.click()
      // Confirm the list grew
      const expandedCount = await coach.activityList().locator('li').count()
      expect(expandedCount).toBeGreaterThan(15)
    }

    // Switch to "My lessons" — the visible count must reset to PAGE (≤15)
    await coach.selectActivityFilter('My lessons')
    const afterSwitch = await coach.activityList().locator('li').count()
    // After switching, the count must be at most 15 (the PAGE constant)
    expect(afterSwitch).toBeLessThanOrEqual(15)
  })

  test('unauthenticated access to /coach/activity redirects to login', async ({ page }) => {
    // Navigate directly without the `as` param — no pre-login cookie is set
    const base = process.env.COACH_URL ?? 'https://club-coach-ten.vercel.app'
    await page.goto(`${base}/coach/activity?reset=1&seed=demo`)

    // The Guard component should redirect to /login (or /coach/login)
    await expect(page).toHaveURL(/login/)
  })

  test('coach-2 does not see events that belong exclusively to coach-1 lessons', async ({ page }) => {
    const coach = new CoachPage(page)

    // Load as coach-2 (Elena Coach) with the demo seed
    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-2', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // Collect all visible event type labels for coach-2
    const items = coach.activityList().locator('li')
    const count = await items.count()

    // For each visible item, verify the metadata does NOT reference lesson-1
    // (which is owned by coach-1). We check the summary text does not contain
    // "Beginner Drills" — the title of coach-1's lesson in the demo seed.
    for (let i = 0; i < count; i++) {
      const summaryText = await items.nth(i).locator('p').first().textContent()
      expect(summaryText ?? '').not.toContain('Beginner Drills')
    }
  })

  test('attendance no-show event appears in Activity feed after marking a student', async ({ page }) => {
    const coach = new CoachPage(page)

    // ── Step 1: Mark a student as no-show in lesson-1 ─────────────────────────
    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))

    // Open lesson-1 "Beginner Drills" from the schedule
    await page.getByText('Beginner Drills').first().click()
    await expect(page.getByRole('heading', { name: 'Beginner Drills' })).toBeVisible()

    // Mark Lucía Fernández as no-show — this now records me.id as the actor
    const noShowBtn = page
      .getByText('Lucía Fernández')
      .locator('xpath=ancestor::li')
      .getByRole('button', { name: 'No-show' })

    await noShowBtn.click()
    await expect(noShowBtn).toHaveAttribute('aria-pressed', 'true')

    // Wait for the success toast (either cascade or simple)
    await expect(
      page.getByText(/Marked/, { exact: false })
    ).toBeVisible()

    // ── Step 2: Navigate to Activity and verify the event appears ─────────────
    // Navigate without reset so the attendance event persists in localStorage
    await page.goto(coachUrl('activity', { reset: false, as: 'coach-1' }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // Switch to "My lessons" filter — attendance events have type "attendance.*"
    await coach.selectActivityFilter('My lessons')

    // At least one event must be visible (the attendance event we just created)
    await expect(coach.emptyState()).not.toBeVisible()
    await expect(coach.activityItem(1)).toBeVisible()

    // The first item's metadata line must reference an attendance event type
    const metaLine = coach.activityItem(1).locator('p').last()
    await expect(metaLine).toContainText('attendance.')
  })

  test('mark-lesson-as-done event appears in Activity feed after completing a lesson', async ({ page }) => {
    const coach = new CoachPage(page)

    // ── Step 1: Create a fresh lesson and mark it as done ─────────────────────
    await page.goto(coachUrl('create', { seed: 'empty', as: 'coach-1', reset: true }))

    const lessonId = await coach.createLesson({
      title: 'Activity Actor Test',
      courtName: 'Court 2',
      date: '2026-10-11',
      start: '09:00',
      end: '10:00',
      capacity: 2,
    })

    // The lesson detail page is now open
    await expect(page.getByRole('heading', { name: 'Activity Actor Test' })).toBeVisible()

    // Click "Mark lesson as done" — this now passes me.id to api.completeLesson
    await page.getByRole('button', { name: 'Mark lesson as done' }).click()

    // Wait for the success toast
    await expect(page.getByText('Lesson marked as done')).toBeVisible()

    // ── Step 2: Navigate to Activity and verify the lesson.done event ─────────
    await page.goto(coachUrl('activity', { reset: false, as: 'coach-1' }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // Switch to "My lessons" filter — lesson.done has type "lesson.*"
    await coach.selectActivityFilter('My lessons')

    await expect(coach.emptyState()).not.toBeVisible()

    // The most recent event should reference the lesson we just completed
    const firstMeta = coach.activityItem(1).locator('p').last()
    await expect(firstMeta).toContainText('lesson.')
  })

  test('keyboard Enter key activates a filter chip (accessibility)', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // Focus the "My lessons" chip and press Enter
    const myLessonsChip = coach.activityFilter('My lessons')
    await myLessonsChip.focus()
    await page.keyboard.press('Enter')

    // The chip must become active via the onKeyDown handler
    await expect(myLessonsChip).toHaveAttribute('aria-pressed', 'true')
  })

  test('keyboard Enter key triggers Show more (accessibility)', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'full', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    const showMore = coach.showMoreButton()
    if (await showMore.isVisible()) {
      const before = await coach.activityList().locator('li').count()

      await showMore.focus()
      await page.keyboard.press('Enter')

      const after = await coach.activityList().locator('li').count()
      expect(after).toBeGreaterThan(before)
    }
  })
})
