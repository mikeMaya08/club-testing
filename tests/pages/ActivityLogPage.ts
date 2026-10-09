import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page object for the Activity Log panel / page.
 *
 * The activity log (introduced in club-store v0.3.0) is surfaced in the Admin
 * app. It exposes `window.__club.state.events` for programmatic assertions and
 * renders a filterable list of events in the UI.
 *
 * Selectors follow the same data-testid conventions used across the project.
 */
export class ActivityLogPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  /** Navigate to the Activity Log section in the Admin app. */
  async goToActivityLog() {
    await this.page.getByRole('link', { name: 'Activity' }).click()
    await expect(this.page.getByTestId('activity-log-page')).toBeVisible()
  }

  // ─── State access (via window.__club) ──────────────────────────────────────

  /**
   * Return the full events array from the in-page store.
   * Requires `window.__club` to be available (all club apps expose it).
   */
  async getEvents(): Promise<Array<Record<string, unknown>>> {
    return this.page.evaluate(() => (window as unknown as { __club: { state: { events: unknown[] } } }).__club.state.events as Array<Record<string, unknown>>)
  }

  /**
   * Return only events whose `type` matches the given value.
   */
  async getEventsByType(type: string): Promise<Array<Record<string, unknown>>> {
    const events = await this.getEvents()
    return events.filter((e) => e['type'] === type)
  }

  /**
   * Return the most recent event in the log.
   */
  async getLastEvent(): Promise<Record<string, unknown> | undefined> {
    const events = await this.getEvents()
    return events[events.length - 1]
  }

  /**
   * Return the total number of events currently in the log.
   */
  async getEventCount(): Promise<number> {
    const events = await this.getEvents()
    return events.length
  }

  // ─── UI interactions ───────────────────────────────────────────────────────

  /** The container that lists rendered event rows. */
  eventList(): Locator {
    return this.page.getByTestId('activity-log-list')
  }

  /** All rendered event rows. */
  eventRows(): Locator {
    return this.eventList().locator('[data-testid^="event-row-"]')
  }

  /** A single event row by its event id (e.g. "evt-1"). */
  eventRow(eventId: string): Locator {
    return this.page.getByTestId(`event-row-${eventId}`)
  }

  /** The type badge / label inside a row. */
  eventTypeBadge(eventId: string): Locator {
    return this.page.getByTestId(`event-type-${eventId}`)
  }

  /** The summary text inside a row. */
  eventSummary(eventId: string): Locator {
    return this.page.getByTestId(`event-summary-${eventId}`)
  }

  // ─── Filters ───────────────────────────────────────────────────────────────

  /** Select an event type from the type filter dropdown. */
  async filterByType(type: string) {
    await this.page.getByTestId('filter-event-type').selectOption(type)
  }

  /** Select an entity from the entity filter dropdown. */
  async filterByEntity(entity: string) {
    await this.page.getByTestId('filter-event-entity').selectOption(entity)
  }

  /** Fill the actor filter input. */
  async filterByActor(actorId: string) {
    await this.page.getByTestId('filter-event-actor').fill(actorId)
  }

  /** Fill the date-from filter. */
  async filterFrom(date: string) {
    await this.page.getByTestId('filter-event-from').fill(date)
  }

  /** Fill the date-to filter. */
  async filterTo(date: string) {
    await this.page.getByTestId('filter-event-to').fill(date)
  }

  /** Clear all active filters. */
  async clearFilters() {
    await this.page.getByTestId('filter-event-clear').click()
  }
}
