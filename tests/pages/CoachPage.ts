import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page object for the Coach app.
 * Covers login, lesson creation, lesson detail, attendance marking,
 * and the new Activity page (club-coach PR #2 – feat/activity-log).
 */
export class CoachPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async loginAs(userId: string) {
    // The coach login uses div[role="button"] instead of <button>
    await this.page.locator(`[data-testid="login-user-${userId}"]`).click().catch(async () => {
      // Fallback: the coach login renders divs with role="button", not data-testid
      // Match by email text
      const emailMap: Record<string, string> = {
        'coach-1': 'carlos.coach@club.test',
        'coach-2': 'elena.coach@club.test',
      }
      await this.page.getByText(emailMap[userId] ?? userId).click()
    })
    await expect(this.page).not.toHaveURL(/\/login/)
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  nav(label: string): Locator {
    return this.page.getByRole('link', { name: label })
  }

  async goToCreateLesson() {
    await this.nav('New lesson').click()
    await expect(this.page.getByRole('heading', { name: 'Create lesson' })).toBeVisible()
  }

  /** Navigate to the Activity page via the nav link. */
  async goToActivity() {
    await this.nav('Activity').click()
    await expect(this.page.getByRole('heading', { name: 'Activity' })).toBeVisible()
  }

  // ─── Create lesson ─────────────────────────────────────────────────────────

  /**
   * Fill and submit the Create Lesson form.
   * Waits for the redirect to the lesson detail page.
   * Returns the lesson ID extracted from the URL.
   */
  async createLesson(opts: {
    title: string
    courtName: string
    date: string   // yyyy-MM-dd
    start: string  // HH:mm
    end: string    // HH:mm
    capacity?: number
  }): Promise<string> {
    const { title, courtName, date, start, end, capacity = 4 } = opts

    await this.page.getByPlaceholder('Serve clinic').fill(title)
    await this.page.getByText('Choose a court').click()
    await this.page.getByRole('option', { name: courtName }).click()
    await this.page.locator('input[type="date"]').fill(date)
    await this.page.locator('input[type="time"]').first().fill(start)
    await this.page.locator('input[type="time"]').last().fill(end)
    await this.page.locator('input[type="number"]').fill(String(capacity))

    // The green "This slot is free" banner should appear before submitting
    await expect(this.page.getByText('This slot is free')).toBeVisible()

    await this.page.getByRole('button', { name: 'Create lesson' }).click()

    // After success, redirected to /lessons/<id>
    await expect(this.page).toHaveURL(/\/lessons\/lesson-/)
    const url = this.page.url()
    return url.split('/lessons/').pop()!
  }

  // ─── Lesson detail ─────────────────────────────────────────────────────────

  async openLesson(lessonId: string) {
    await this.page.goto(this.page.url().replace(/\/[^/]*$/, '') + `/lessons/${lessonId}`)
    await expect(this.page.getByRole('link', { name: '‹ Schedule' })).toBeVisible()
  }

  enrolledCount(): Locator {
    return this.page.getByText(/Enrolled: \d+ of \d+/)
  }

  studentRow(name: string): Locator {
    return this.page.getByText(name).locator('xpath=ancestor::li')
  }

  async markAttendance(studentName: string, value: 'present' | 'no-show') {
    const row = this.studentRow(studentName)
    const btn = row.getByRole('button', { name: value === 'present' ? 'Present' : 'No-show' })
    await btn.click()
    // Wait for the pill to become active (aria-pressed="true")
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  }

  // ─── Activity page ─────────────────────────────────────────────────────────

  /**
   * Returns the filter chip button by its visible label.
   * Chips use role="button" with aria-pressed to indicate the active filter.
   */
  activityFilter(label: 'All' | 'My lessons' | 'Notes and templates'): Locator {
    return this.page
      .getByRole('group', { name: 'Filter activity' })
      .getByRole('button', { name: label })
  }

  /**
   * Click an activity filter chip and wait for it to become active
   * (aria-pressed="true").
   */
  async selectActivityFilter(label: 'All' | 'My lessons' | 'Notes and templates') {
    const chip = this.activityFilter(label)
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  }

  /** Returns the ordered list of activity events. */
  activityList(): Locator {
    return this.page.locator('ol').filter({ has: this.page.locator('li') })
  }

  /** Returns a single activity list item by its 1-based index. */
  activityItem(index: number): Locator {
    return this.activityList().locator('li').nth(index - 1)
  }

  /** Returns the "No activity yet." empty-state element. */
  emptyState(): Locator {
    return this.page.getByText('No activity yet.')
  }

  /** Returns the "Show more" button when pagination is available. */
  showMoreButton(): Locator {
    return this.page.getByRole('button', { name: /Show more/ })
  }
}
