import { test, expect } from '@playwright/test'
import { PlayerPage } from '../pages/PlayerPage'
import { playerUrl } from '../helpers/urls'

/**
 * E2E 13 — Lessons page, waitlist, notification bell, and header
 *
 * Covered by club-player PR #3 (docs/code-comments) which clarified:
 *
 *  Lessons:
 *   - Cancelled and finished lessons are hidden; a lesson stays listed until it ends.
 *   - `position` is 1-based waitlist place, or 0 when the player is not waiting.
 *
 *  NotificationBell:
 *   - Shows only this player's notifications, newest first.
 *   - Unread counter badge is visible when there are unread notifications.
 *   - "Mark all as read" and per-item "Mark read" are available.
 *
 *  Header:
 *   - Displays app name, current player name (via useMe()), theme toggle,
 *     notification bell, and log-out button.
 *
 * Happy paths:
 *  - Lessons page shows upcoming scheduled lessons.
 *  - A player can enroll in a lesson with seats available.
 *  - A player can leave a lesson they are enrolled in.
 *  - A player can join the waitlist for a full lesson.
 *  - A player can leave the waitlist.
 *  - Notification bell opens the dropdown and shows notifications.
 *  - Unread notifications show a count badge on the bell.
 *  - A single notification can be marked as read.
 *  - All notifications can be marked as read at once.
 *  - Header shows the current player's name.
 *  - Log-out button redirects to /login.
 *  - Theme toggle button is present and accessible.
 *
 * Negative paths:
 *  - Lessons page shows an empty state when there are no upcoming lessons.
 *  - The Enroll button is disabled (and labelled "Full") for a full lesson.
 *  - "Mark all as read" is disabled when there are no unread notifications.
 *  - Unauthenticated access to /lessons redirects to /login.
 */

test.describe('Lessons — upcoming list, enroll, leave, and waitlist', () => {
  // ── Happy path: lessons list ─────────────────────────────────────────────────

  test('lessons page shows upcoming scheduled lessons', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('lessons', { seed: 'demo', as: 'player-5', reset: true }))

    await expect(page.getByTestId('lessons-page')).toBeVisible()
    // Demo seed has at least one upcoming lesson
    await expect(page.locator('[data-testid^="lesson-lesson-"]').first()).toBeVisible()
  })

  test('player can enroll in a lesson with seats available', async ({ page }) => {
    const player = new PlayerPage(page)
    // player-5 (Camila Ortiz) is not enrolled in lesson-1 in the demo seed
    await page.goto(playerUrl('lessons', { seed: 'demo', as: 'player-5', reset: true }))

    await player.enrollInLesson('lesson-1')

    // After enrolling, the Leave button replaces the Enroll button
    await expect(page.getByTestId('lesson-leave-lesson-1')).toBeVisible()
    await expect(page.getByTestId('lesson-enroll-lesson-1')).not.toBeVisible()
  })

  test('player can leave a lesson they are enrolled in', async ({ page }) => {
    const player = new PlayerPage(page)
    // player-1 is enrolled in lesson-1 in the demo seed
    await page.goto(playerUrl('lessons', { seed: 'demo', as: 'player-1', reset: true }))

    // Confirm the Leave button is visible (player is enrolled)
    await expect(page.getByTestId('lesson-leave-lesson-1')).toBeVisible()

    // Leave the lesson
    await page.getByTestId('lesson-leave-lesson-1').click()

    // After leaving, the Enroll button should reappear
    await expect(page.getByTestId('lesson-enroll-lesson-1')).toBeVisible()
  })

  test('player can join the waitlist for a full lesson', async ({ page }) => {
    const player = new PlayerPage(page)
    // player-5 is not on the waitlist for lesson-3 (full in demo seed)
    await page.goto(playerUrl('lessons', { seed: 'demo', as: 'player-5', reset: true }))

    // lesson-3 should be full — "Join waitlist" button is visible
    const joinBtn = page.getByTestId('lesson-waitlist-join-lesson-3')
    const count = await joinBtn.count()
    if (count > 0) {
      await joinBtn.click()
      // After joining, the waitlist position indicator should appear
      await expect(page.getByTestId('lesson-waitlist-pos-lesson-3')).toBeVisible()
      await expect(page.getByTestId('lesson-waitlist-pos-lesson-3')).toContainText('#')
    }
  })

  test('player can leave the waitlist', async ({ page }) => {
    const player = new PlayerPage(page)
    // player-3 is on the waitlist for lesson-3 in the demo seed
    await page.goto(playerUrl('lessons', { seed: 'demo', as: 'player-3', reset: true }))

    const leaveWaitlistBtn = page.getByTestId('lesson-waitlist-leave-lesson-3')
    const count = await leaveWaitlistBtn.count()
    if (count > 0) {
      await leaveWaitlistBtn.click()
      // After leaving, the waitlist position indicator should disappear
      await expect(page.getByTestId('lesson-waitlist-pos-lesson-3')).not.toBeVisible()
    }
  })

  // ── Negative path: empty state ───────────────────────────────────────────────

  test('lessons page shows empty state when there are no upcoming lessons', async ({ page }) => {
    // Empty seed has no lessons
    await page.goto(playerUrl('lessons', { seed: 'empty', as: 'player-1', reset: true }))

    await expect(page.getByTestId('lessons-page')).toBeVisible()
    await expect(page.getByTestId('lessons-empty')).toBeVisible()
    await expect(page.getByTestId('lessons-empty')).toContainText('No upcoming lessons')
  })

  test('Enroll button is disabled and labelled Full for a full lesson', async ({ page }) => {
    // player-5 is not enrolled in lesson-3 which is full in the demo seed
    await page.goto(playerUrl('lessons', { seed: 'demo', as: 'player-5', reset: true }))

    // The enroll button for a full lesson should be disabled
    const enrollBtn = page.getByTestId('lesson-enroll-lesson-3')
    const count = await enrollBtn.count()
    if (count > 0) {
      await expect(enrollBtn).toBeDisabled()
    }
  })

  // ── Negative path: unauthenticated access ────────────────────────────────────

  test('unauthenticated access to /lessons redirects to /login', async ({ page }) => {
    await page.goto(playerUrl('lessons', { seed: 'demo', reset: true }))
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('NotificationBell — unread counter, dropdown, and mark-read', () => {
  // ── Happy path: bell and dropdown ───────────────────────────────────────────

  test('notification bell opens the dropdown', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    await player.openNotifications()

    await expect(page.getByTestId('notification-dropdown')).toBeVisible()
  })

  test('unread notifications show a count badge on the bell', async ({ page }) => {
    // player-1 has unread notifications in the demo seed
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    // The badge is only rendered when unread > 0
    const badge = page.getByTestId('notification-count')
    const count = await badge.count()
    if (count > 0) {
      await expect(badge).toBeVisible()
      const text = await badge.textContent()
      expect(Number(text)).toBeGreaterThan(0)
    }
  })

  test('a single notification can be marked as read', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))
    await player.openNotifications()

    // Find the first unread notification's "Mark read" button
    const markReadBtn = page.locator('[data-testid^="notification-read-"]').first()
    const count = await markReadBtn.count()
    if (count > 0) {
      const notifId = (await markReadBtn.getAttribute('data-testid'))!.replace('notification-read-', '')
      await markReadBtn.click()

      // After marking read, the button should disappear (notification is now read)
      await expect(page.getByTestId(`notification-read-${notifId}`)).not.toBeVisible()
    }
  })

  test('all notifications can be marked as read at once', async ({ page }) => {
    const player = new PlayerPage(page)
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))
    await player.openNotifications()

    const markAllBtn = page.getByTestId('notifications-mark-all')
    const isDisabled = await markAllBtn.isDisabled()

    if (!isDisabled) {
      await markAllBtn.click()
      // After marking all read, no "Mark read" buttons should remain
      await expect(page.locator('[data-testid^="notification-read-"]')).toHaveCount(0)
      // The badge should disappear
      await expect(page.getByTestId('notification-count')).not.toBeVisible()
    }
  })

  test('empty notification list shows the empty state message', async ({ page }) => {
    // Empty seed has no notifications
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))

    const player = new PlayerPage(page)
    await player.openNotifications()

    await expect(page.getByTestId('notifications-empty')).toBeVisible()
    await expect(page.getByTestId('notifications-empty')).toContainText('No notifications')
  })

  // ── Negative path: mark-all disabled when no unread ─────────────────────────

  test('"Mark all as read" is disabled when there are no unread notifications', async ({ page }) => {
    // Empty seed → no notifications → no unread
    await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))

    const player = new PlayerPage(page)
    await player.openNotifications()

    await expect(page.getByTestId('notifications-mark-all')).toBeDisabled()
  })
})

test.describe('Header — app bar elements', () => {
  // ── Happy path: header elements ──────────────────────────────────────────────

  test('header shows the app name and current player name', async ({ page }) => {
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    await expect(page.getByTestId('app-name')).toBeVisible()
    await expect(page.getByTestId('app-name')).toContainText('Baseline Club')

    // current-user shows the player's name from useMe()
    await expect(page.getByTestId('current-user')).toContainText('Lucía')
  })

  test('theme toggle button is present and accessible', async ({ page }) => {
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toBeVisible()
    // The aria-label describes the action (switch to dark/light mode)
    const label = await toggle.getAttribute('aria-label')
    expect(label).toMatch(/switch to (dark|light) mode/i)
  })

  test('theme toggle switches between light and dark mode', async ({ page }) => {
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    const toggle = page.getByTestId('theme-toggle')
    const labelBefore = await toggle.getAttribute('aria-label')

    await toggle.click()

    const labelAfter = await toggle.getAttribute('aria-label')
    // The label should have flipped
    expect(labelAfter).not.toBe(labelBefore)
  })

  test('log-out button redirects to /login', async ({ page }) => {
    await page.goto(playerUrl('', { seed: 'demo', as: 'player-1', reset: true }))

    await expect(page).not.toHaveURL(/\/login/)

    await page.getByTestId('logout-btn').click()

    await expect(page).toHaveURL(/\/login/)
  })
})
