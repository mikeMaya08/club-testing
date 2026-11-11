import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page object for the Admin app.
 * Covers login, reservations, users, settings, and the notification bell.
 */
export class AdminPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  /** Click the login button for a given userId (e.g. 'admin-1'). */
  async loginAs(userId: string) {
    await this.page.getByTestId(`login-user-${userId}`).click()
    // Wait for redirect away from /login
    await expect(this.page).not.toHaveURL(/\/login/)
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  nav(label: string): Locator {
    return this.page.getByRole('link', { name: label })
  }

  async goToReservations() {
    await this.nav('Reservations').click()
    await expect(this.page.getByTestId('reservations-page')).toBeVisible()
  }

  async goToUsers() {
    await this.nav('Users').click()
    await expect(this.page.getByTestId('users-page')).toBeVisible()
  }

  async goToSettings() {
    await this.nav('Settings').click()
    await expect(this.page.getByTestId('settings-page')).toBeVisible()
  }

  async goToCalendar() {
    await this.nav('Calendar').click()
    await expect(this.page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  }

  // ─── Reservations ──────────────────────────────────────────────────────────

  /** Find the first reservation row that matches a given status. */
  firstRowWithStatus(status: string): Locator {
    return this.page.locator(`[data-testid^="res-row-"][data-status="${status}"]`).first()
  }

  /** Extract the reservation id from the row's data-testid attribute. */
  async resIdFromRow(row: Locator): Promise<string> {
    const testId = await row.getAttribute('data-testid')
    // data-testid="res-row-res-3" → "res-3"
    return testId!.replace('res-row-', '')
  }

  async cancelReservation(resId: string) {
    await this.page.getByTestId(`res-cancel-${resId}`).click()
    await this.page.getByTestId('res-cancel-confirm').click()
  }

  async markNoShow(resId: string) {
    await this.page.getByTestId(`res-noshow-${resId}`).click()
  }

  async filterByStatus(status: string) {
    await this.page.getByTestId('filter-status').selectOption(status)
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  async setUserActive(userId: string, active: boolean) {
    const checkbox = this.page.getByTestId(`user-active-${userId}`)
    const currentlyChecked = await checkbox.isChecked()
    if (currentlyChecked !== active) {
      await checkbox.click()
      // Confirm the deactivate / reactivate dialog
      await this.page.getByTestId('user-confirm-ok').click()
    }
  }

  async userRowStatus(userId: string): Promise<string | null> {
    return this.page.getByTestId(`user-status-${userId}`).textContent()
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  async setBasePrice(price: number) {
    const input = this.page.getByTestId('setting-basePrice')
    await input.fill(String(price))
  }

  async saveSettings() {
    await this.page.getByTestId('settings-save').click()
    // Wait for the success toast
    await expect(this.page.getByText('Settings saved')).toBeVisible()
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async openNotifications() {
    await this.page.getByTestId('notification-bell').click()
    await expect(this.page.getByTestId('notification-dropdown')).toBeVisible()
  }

  notificationWithText(text: string): Locator {
    return this.page.getByTestId('notification-dropdown').getByText(text)
  }

  // ─── Toasts / session ──────────────────────────────────────────────────────

  /** A toast (success or error) containing the given text. */
  toast(text: string | RegExp): Locator {
    return this.page.getByTestId('toast').filter({ hasText: text })
  }

  async logout() {
    await this.page.getByTestId('logout-btn').click()
    await expect(this.page).toHaveURL(/\/login/)
  }

  // ─── Courts ────────────────────────────────────────────────────────────────

  async goToCourts() {
    await this.page.getByRole('link', { name: 'Courts', exact: true }).click()
    await expect(this.page.getByTestId('courts-page')).toBeVisible()
  }

  /** Fill and submit the "Add court" form. */
  async addCourt(name: string, surface: 'clay' | 'hard', lights: boolean) {
    await this.page.getByTestId('court-name-input').fill(name)
    await this.page.getByTestId('court-surface-select').selectOption(surface)
    await this.page.getByTestId('court-lights-input').setChecked(lights)
    await this.page.getByTestId('court-add').click()
  }

  /** Courts table row whose name cell matches exactly (useful for courts created in the test). */
  courtRowByName(name: string): Locator {
    return this.page
      .locator('[data-testid^="court-row-"]')
      .filter({ has: this.page.getByText(name, { exact: true }) })
  }

  async renameCourt(courtId: string, newName: string) {
    await this.page.getByTestId(`court-edit-${courtId}`).click()
    await this.page.getByTestId('court-edit-input').fill(newName)
    await this.page.getByTestId('court-edit-save').click()
  }

  /** Open the delete dialog and confirm it. */
  async deleteCourt(courtId: string) {
    await this.page.getByTestId(`court-delete-${courtId}`).click()
    await this.page.getByTestId('court-delete-confirm').click()
  }

  // ─── Reservations table ────────────────────────────────────────────────────

  /** Rows currently rendered in the reservations table (current page only). */
  reservationRows(): Locator {
    return this.page.locator('[data-testid^="res-row-"]')
  }

  /** Text of every cell with the given testid prefix, e.g. 'res-price-' or 'res-date-'. */
  async reservationColumn(prefix: 'res-date-' | 'res-court-' | 'res-player-' | 'res-status-' | 'res-price-'): Promise<string[]> {
    return this.page.locator(`[data-testid^="${prefix}"]`).allTextContents()
  }

  async sortBy(key: 'date' | 'court' | 'player' | 'status' | 'price') {
    await this.page.getByTestId(`sort-${key}`).click()
  }

  /** The <th> that wraps a sort button (carries aria-sort). */
  sortHeader(key: 'date' | 'court' | 'player' | 'status' | 'price'): Locator {
    return this.page.locator('th').filter({ has: this.page.getByTestId(`sort-${key}`) })
  }

  /** Click "Export CSV" and return the triggered download. */
  async exportCsv() {
    const downloadPromise = this.page.waitForEvent('download')
    await this.page.getByTestId('export-csv').click()
    return downloadPromise
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  async setUserRole(userId: string, role: 'player' | 'coach' | 'admin') {
    await this.page.getByTestId(`user-role-${userId}`).selectOption(role)
  }

  // ─── Settings (generic) ────────────────────────────────────────────────────

  async setSetting(key: string, value: string) {
    await this.page.getByTestId(`setting-${key}`).fill(value)
  }
}
