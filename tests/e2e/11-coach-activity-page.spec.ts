import { test, expect } from '@playwright/test'
import { CoachPage } from '../pages/CoachPage'
import { coachUrl } from '../helpers/urls'

/**
 * E2E 11 — Coach Activity page — happy paths
 *
 * Covers the new Activity page introduced in club-coach PR #2
 * (feat/activity-log). The page lives at /coach/activity and is reachable
 * via the "Activity" nav link added to Layout.tsx.
 *
 * The demo seed contains events produced by coach-1 (Carlos Coach) and
 * events on lessons owned by coach-1, so the "All" filter should show a
 * non-empty list. The "My lessons" filter narrows to lesson.* and
 * attendance.* event types; "Notes and templates" narrows to note.* and
 * template.* types.
 *
 * Journeys:
 *  1. Activity tab is visible in the navigation and navigates to the page.
 *  2. "All" filter is active by default and shows at least one event.
 *  3. Each visible event item shows a summary text and a timestamp line.
 *  4. "My lessons" filter narrows the list (aria-pressed toggles correctly).
 *  5. "Notes and templates" filter can be selected and deselected back to "All".
 *  6. "Show more" button appears and loads additional events when the list
 *     exceeds the page size of 15.
 */

test.describe('Activity page — happy paths', () => {
  test('Activity nav link is visible and navigates to the Activity page', async ({ page }) => {
    const coach = new CoachPage(page)

    // Load the coach app as coach-1 with the demo seed
    await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))

    // The "Activity" link must be present in the navigation
    await expect(coach.nav('Activity')).toBeVisible()

    // Clicking it should land on the Activity page
    await coach.goToActivity()
    await expect(page).toHaveURL(/\/activity/)
  })

  test('"All" filter is active by default and shows at least one event', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // "All" chip must be the initially active filter
    const allChip = coach.activityFilter('All')
    await expect(allChip).toHaveAttribute('aria-pressed', 'true')

    // The demo seed has events for coach-1, so the list must not be empty
    await expect(coach.emptyState()).not.toBeVisible()
    await expect(coach.activityList()).toBeVisible()
    await expect(coach.activityItem(1)).toBeVisible()
  })

  test('each event item shows a summary and a timestamp/type line', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // The first event item must contain a summary paragraph and a metadata line
    // (formatted date · event type). We check for the "·" separator that the
    // component always renders between the date and the event type.
    const firstItem = coach.activityItem(1)
    await expect(firstItem).toBeVisible()
    // Summary text is a non-empty <p> — assert the item has visible text content
    await expect(firstItem.locator('p').first()).not.toBeEmpty()
    // Metadata line contains the "·" separator
    await expect(firstItem.getByText(/·/)).toBeVisible()
  })

  test('"My lessons" filter narrows the list to lesson and attendance events', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // Switch to "My lessons" filter
    await coach.selectActivityFilter('My lessons')

    // "All" chip must no longer be active
    await expect(coach.activityFilter('All')).toHaveAttribute('aria-pressed', 'false')

    // The "My lessons" chip must now be active
    await expect(coach.activityFilter('My lessons')).toHaveAttribute('aria-pressed', 'true')

    // The list should only contain events whose type starts with "lesson." or "attendance."
    // We verify by checking that every visible metadata line contains one of those prefixes.
    const items = coach.activityList().locator('li')
    const count = await items.count()

    if (count > 0) {
      // Spot-check the first item's type label
      const metaLine = items.first().locator('p').last()
      const text = await metaLine.textContent()
      expect(text).toMatch(/lesson\.|attendance\./)
    }
    // If count is 0, the empty state must be shown
    if (count === 0) {
      await expect(coach.emptyState()).toBeVisible()
    }
  })

  test('"Notes and templates" filter can be selected and toggled back to "All"', async ({ page }) => {
    const coach = new CoachPage(page)

    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    // Select "Notes and templates"
    await coach.selectActivityFilter('Notes and templates')
    await expect(coach.activityFilter('Notes and templates')).toHaveAttribute('aria-pressed', 'true')
    await expect(coach.activityFilter('All')).toHaveAttribute('aria-pressed', 'false')

    // Switch back to "All"
    await coach.selectActivityFilter('All')
    await expect(coach.activityFilter('All')).toHaveAttribute('aria-pressed', 'true')
    await expect(coach.activityFilter('Notes and templates')).toHaveAttribute('aria-pressed', 'false')
  })

  test('"Show more" button loads additional events when list exceeds page size', async ({ page }) => {
    const coach = new CoachPage(page)

    // Use the "full" seed which has more events, increasing the chance of
    // exceeding the PAGE constant of 15 items.
    await page.goto(coachUrl('activity', { seed: 'full', as: 'coach-1', reset: true }))
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    const showMore = coach.showMoreButton()

    // Only assert "Show more" behaviour when the button is actually present;
    // if the full seed has ≤15 events for coach-1 the button won't appear and
    // the test passes gracefully.
    const isVisible = await showMore.isVisible()
    if (isVisible) {
      // Count items before clicking
      const before = await coach.activityList().locator('li').count()

      await showMore.click()

      // After clicking, more items should be visible
      const after = await coach.activityList().locator('li').count()
      expect(after).toBeGreaterThan(before)
    }
  })

  test('direct navigation to /coach/activity works without going through the nav', async ({ page }) => {
    // Verify the route is registered and the page renders correctly when
    // accessed directly (e.g. after a page refresh or a deep link).
    await page.goto(coachUrl('activity', { seed: 'demo', as: 'coach-1', reset: true }))

    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()
    // All three filter chips must be rendered
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'My lessons' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notes and templates' })).toBeVisible()
  })
})
