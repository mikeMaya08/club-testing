import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page object for the Coach app.
 * Covers login, lesson creation, lesson detail, and attendance marking.
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
    await this.nav('Create lesson').click() // was 'New lesson' (no such link in the app)
    await expect(this.page).toHaveURL(/\/coach\/lessons\/new/)
    await expect(this.page.getByRole('heading', { name: 'Create lesson' })).toBeVisible()
  }

  // ─── Create-lesson form (role/label locators: this app has no data-testid) ─

  titleInput()     { return this.page.getByLabel('Title', { exact: true }) }
  dateInput()      { return this.page.getByLabel('Date', { exact: true }) }
  startInput()     { return this.page.getByLabel('Start', { exact: true }) }
  endInput()       { return this.page.getByLabel('End', { exact: true }) }
  capacityInput()  { return this.page.getByLabel('Capacity', { exact: true }) }
  courtSelect()    { return this.page.getByRole('combobox', { name: 'Court' }) }
  templateSelect() { return this.page.getByRole('combobox', { name: 'Template' }) }

  /** Custom dropdown (no native <select>): open the combobox, then pick the option. */
  async chooseCourt(name: string) {
    await this.courtSelect().click()
    await this.page.getByRole('option', { name }).click()
  }

  async chooseTemplate(name: string) {
    await this.templateSelect().click()
    await this.page.getByRole('option', { name }).click()
  }

  async fillSchedule(opts: { date: string; start: string; end: string }) {
    await this.dateInput().fill(opts.date)
    await this.startInput().fill(opts.start)
    await this.endInput().fill(opts.end)
  }

  slotFreeBanner() {
    return this.page.getByText('This slot is free.')
  }

  conflictAlert() {
    return this.page.getByRole('alert').filter({ hasText: 'This lesson cannot be scheduled' })
  }

  // ─── Templates ─────────────────────────────────────────────────────────────

  templatesSection() {
    return this.page.getByRole('region', { name: 'Templates' })
  }

  templateRow(name: string) {
    return this.templatesSection().getByRole('listitem').filter({ hasText: name })
  }

  async saveAsTemplate(name: string) {
    await this.page.getByLabel('Save the form above as a template').fill(name)
    await this.page.getByRole('button', { name: 'Save template' }).click()
  }

  async deleteTemplate(name: string) {
    await this.templatesSection().getByRole('button', { name: `Delete template ${name}` }).click()
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

  // ─── Students & notes ──────────────────────────────────────────────────────

  async goToStudents() {
    await this.page.getByRole('link', { name: 'Students', exact: true }).click()
    await expect(this.page).toHaveURL(/\/coach\/students/)
    await expect(this.page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible()
  }

  async goToStudentNotes() {
    await this.page.getByRole('link', { name: 'Student notes' }).click()
    await expect(this.page).toHaveURL(/\/coach\/notes/)
    await expect(this.page.getByRole('heading', { name: 'Student notes' })).toBeVisible()
  }

  /** Roster row of a student on the Students page (nearest ancestor holding the "Add note" link). */
  rosterRow(name: string): Locator {
    return this.page.getByText(name).locator('xpath=ancestor::div[.//a[normalize-space()="Add note"]][1]')
  }

  studentSelect(): Locator {
    return this.page.getByRole('combobox', { name: 'Student' })
  }

  async chooseStudent(name: string) {
    await this.studentSelect().click()
    await this.page.getByRole('option', { name }).click()
  }

  /** The note editor is a contentEditable div (no label / testid). */
  noteEditor(): Locator {
    return this.page.locator('[contenteditable="true"]')
  }

  async writeNote(text: string) {
    await this.noteEditor().fill(text)
  }

  /** Stars live in the open shadow DOM of <club-rating>; getByRole pierces it. */
  async rate(stars: 1 | 2 | 3 | 4 | 5) {
    // Only the editor's rating is interactive; the history ratings in "Previous notes" are disabled.
    await this.page.getByRole('button', { name: `${stars} star${stars > 1 ? 's' : ''}`, exact: true, disabled: false }).click()
  }

  saveNoteButton(): Locator {
    return this.page.getByRole('button', { name: 'Save note' })
  }

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
}
