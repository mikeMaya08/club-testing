import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page object for the Player app.
 * Covers login, court availability / booking, reservations, and lessons.
 */
export class PlayerPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async loginAs(userId: string) {
    await this.page.getByTestId(`login-user-${userId}`).click()
    await expect(this.page).not.toHaveURL(/\/login/)
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  nav(label: string): Locator {
    return this.page.getByRole('link', { name: label })
  }

  async goToAvailability() {
    await this.nav('Book').click()
    await expect(this.page.getByTestId('availability-page')).toBeVisible()
  }

  async goToReservations() {
    await this.nav('Reservations').click()
    await expect(this.page.getByTestId('reservations-page')).toBeVisible()
  }

  async goToLessons() {
    await this.nav('Lessons').click()
    await expect(this.page.getByTestId('lessons-page')).toBeVisible()
  }

  // ─── Availability / booking ────────────────────────────────────────────────

  /**
   * Click the first slot with state 'available' on the grid.
   * Returns the slot's data-testid so callers can assert on it later.
   */
  async clickFirstAvailableSlot(): Promise<string> {
    const slot = this.page.locator('[data-state="available"]').first()
    await expect(slot).toBeVisible()
    const testId = await slot.getAttribute('data-testid')
    await slot.click()
    return testId!
  }

  /**
   * Complete the 3-step booking modal (no partner, straight confirm).
   * Waits for the modal to close before returning.
   */
  async confirmBooking() {
    // Step 1 — court details
    await expect(this.page.getByTestId('booking-modal')).toBeVisible()
    await this.page.getByTestId('booking-next').click()

    // Step 2 — optional partner, skip
    await this.page.getByTestId('booking-next').click()

    // Step 3 — summary & confirm
    await this.page.getByTestId('booking-confirm').click()

    // Modal should close after success
    await expect(this.page.getByTestId('booking-modal')).not.toBeVisible()
  }

  /** Read the price shown on step 3 of the booking modal (opens after step 2). */
  async bookingModalTotalText(): Promise<string | null> {
    return this.page.getByTestId('summary-total').textContent()
  }

  // ─── Reservations ──────────────────────────────────────────────────────────

  /** Switch between 'upcoming' and 'history' tabs. */
  async selectTab(tab: 'upcoming' | 'history') {
    await this.page.getByTestId(`tab-${tab}`).click()
  }

  /** Return all reservation rows currently visible in the given tab list. */
  reservationRows(tab: 'upcoming' | 'history'): Locator {
    return this.page.getByTestId(`${tab}-list`).locator('[data-testid^="reservation-"]')
  }

  /** Return the status badge text for a specific reservation. */
  async reservationStatus(resId: string): Promise<string | null> {
    return this.page.getByTestId(`reservation-status-${resId}`).textContent()
  }

  /** Cancel a reservation through the modal. */
  async cancelReservation(resId: string) {
    await this.page.getByTestId(`cancel-btn-${resId}`).click()
    await this.page.getByTestId('cancel-confirm').click()
    await expect(this.page.getByTestId('cancel-dialog')).not.toBeVisible()
  }

  // ─── Weekly recurring bookings ─────────────────────────────────────────────

  /** Pick the date on the availability grid (yyyy-MM-dd). */
  async selectDate(isoDate: string) {
    const input = this.page.getByTestId('date-input')
    await input.fill(isoDate)
    await expect(input).toHaveValue(isoDate)
  }

  /** Step 1 of the booking modal: choose "Every week for N weeks" (1 = just once). */
  async chooseRepeatWeeks(weeks: 1 | 2 | 4 | 6 | 8) {
    await this.page.getByTestId('repeat-weeks').selectOption(String(weeks))
  }

  /** Move from step 1 to the step-3 summary, skipping the optional partner. */
  async advanceToBookingSummary() {
    const step = this.page.getByTestId('booking-step')
    await this.page.getByTestId('booking-next').click()
    await expect(step).toHaveAttribute('data-step', '2')
    await this.page.getByTestId('booking-next').click()
    await expect(step).toHaveAttribute('data-step', '3')
  }

  /** Confirm from the summary step and wait for the modal to close. */
  async submitBooking() {
    await this.page.getByTestId('booking-confirm').click()
    await expect(this.page.getByTestId('booking-modal')).not.toBeVisible()
  }

  /** Close the booking modal with its ✕ button. */
  async closeBookingModal() {
    await this.page.getByTestId('booking-modal-close').click()
    await expect(this.page.getByTestId('booking-modal')).not.toBeVisible()
  }

  /** Toast of a given kind; pass text to avoid matching several stacked toasts. */
  toast(kind: 'success' | 'error', text?: string | RegExp): Locator {
    const toasts = this.page.locator(`[data-testid="toast"][data-kind="${kind}"]`)
    return text ? toasts.filter({ hasText: text }) : toasts
  }

  /** One row per upcoming booked session (the <li> carries data-status). */
  upcomingBookedRows(): Locator {
    return this.page.getByTestId('upcoming-list').locator('li[data-status="booked"]')
  }

  /** "↻ Weekly series" badges in the Upcoming list. */
  seriesBadges(): Locator {
    return this.page.locator('[data-testid^="reservation-series-"]')
  }

  /** The single "Cancel series (N)" button on the first session of a series. */
  cancelSeriesButton(): Locator {
    return this.page.locator(
      'button[data-testid^="cancel-series-"]' +
        ':not([data-testid^="cancel-series-dialog"])' +
        ':not([data-testid="cancel-series-confirm"])' +
        ':not([data-testid="cancel-series-dismiss"])' +
        ':not([data-testid*="tooltip"])',
    )
  }

  // ─── Lessons ───────────────────────────────────────────────────────────────

  async enrollInLesson(lessonId: string) {
    await this.page.getByTestId(`lesson-enroll-${lessonId}`).click()
    await expect(this.page.getByTestId(`lesson-leave-${lessonId}`)).toBeVisible()
  }

  lessonSeatsLeft(lessonId: string): Locator {
    return this.page.getByTestId(`lesson-seats-${lessonId}`)
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async openNotifications() {
    await this.page.getByTestId('notification-bell').click()
    await expect(this.page.getByTestId('notification-dropdown')).toBeVisible()
  }

  notificationWithText(text: string): Locator {
    return this.page.getByTestId('notification-dropdown').getByText(text)
  }
}
