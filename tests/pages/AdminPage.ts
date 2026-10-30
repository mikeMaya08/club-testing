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

  async goToCourts() {
    await this.nav('Courts').click()
    await expect(this.page.getByTestId('courts-page')).toBeVisible()
  }

  async logout() {
    await this.page.getByTestId('logout-btn').click()
    await expect(this.page).toHaveURL(/\/login/)
  }

  // ─── Courts ────────────────────────────────────────────────────────────────

  /** Court table row located by the court's visible name. */
  courtRowByName(name: string): Locator {
    return this.page.locator('[data-testid^="court-row-"]').filter({ hasText: name })
  }

  /** Fill the "add court" form and submit it. */
  async addCourt(name: string, surface: 'clay' | 'hard', lights: boolean) {
    await this.page.getByTestId('court-name-input').fill(name)
    await this.page.getByTestId('court-surface-select').selectOption(surface)
    await this.page.getByTestId('court-lights-input').setChecked(lights)
    await this.page.getByTestId('court-add').click()
    await expect(this.courtRowByName(name)).toBeVisible()
  }

  /** Rename a court through its modal (row is located by its current name). */
  async renameCourt(currentName: string, newName: string) {
    await this.courtRowByName(currentName).getByRole('button', { name: 'Rename' }).click()
    await this.page.getByTestId('court-edit-input').fill(newName)
    await this.page.getByTestId('court-edit-save').click()
    await expect(this.page.getByTestId('court-edit-dialog')).not.toBeVisible()
  }

  /** Delete a court and confirm the dialog. */
  async deleteCourt(name: string) {
    await this.courtRowByName(name).getByRole('button', { name: 'Delete' }).click()
    await this.page.getByTestId('court-delete-confirm').click()
  }

  // ─── Users (roles) ─────────────────────────────────────────────────────────

  async setUserRole(userId: string, role: 'player' | 'coach' | 'admin') {
    await this.page.getByTestId(`user-role-${userId}`).selectOption(role)
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
}
