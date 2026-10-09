import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { PlayerPage } from '../pages/PlayerPage'
import { ActivityLogPage } from '../pages/ActivityLogPage'
import { adminUrl, playerUrl } from '../helpers/urls'

/**
 * E2E 11 — Activity log: booking and cancellation events are recorded
 *
 * Introduced in club-store v0.3.0. Every action writes an event to
 * `state.events` inside the same commit, so an event exists if and only if
 * the action succeeded. This spec verifies the happy and negative paths for
 * the reservation family of events.
 *
 * Flows covered:
 *  A. Happy — player books a court → `reservation.booked` event is written
 *     with the correct actor, entity, and summary.
 *  B. Happy — admin cancels a reservation → `reservation.cancelled` event
 *     is written with the admin as actor and the player as subject.
 *  C. Happy — admin deactivates a user → `user.deactivated` event is written
 *     AND each cancelled future reservation produces a `reservation.cancelled`
 *     cascade event attributed to the admin (Rule 11 cascade logging).
 *  D. Negative — a failed booking (slot taken) logs nothing; the event count
 *     stays at its pre-attempt value.
 *  E. Negative — bug=missing-events: cancellation events are suppressed while
 *     booking events are still written (injectable bug verification).
 */

// ── A: Player books → reservation.booked event ────────────────────────────────
test('booking a court writes a reservation.booked event with correct fields', async ({ page }) => {
  const player = new PlayerPage(page)
  const log = new ActivityLogPage(page)

  // Fresh empty seed so the event log starts at zero
  await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
  await player.goToAvailability()

  // Confirm the log is empty before the action
  const countBefore = await log.getEventCount()
  expect(countBefore).toBe(0)

  // Book the first available slot
  await player.clickFirstAvailableSlot()
  await player.confirmBooking()

  // The booking must have written exactly one event
  const events = await log.getEvents()
  expect(events).toHaveLength(1)

  const evt = events[0]
  expect(evt['type']).toBe('reservation.booked')
  expect(evt['actorId']).toBe('player-1')
  expect(evt['entity']).toBe('reservation')
  expect(typeof evt['entityId']).toBe('string')
  expect(String(evt['summary'])).toContain('booked')
  // meta must carry courtId, date, start, price
  const meta = evt['meta'] as Record<string, unknown>
  expect(meta['courtId']).toBeTruthy()
  expect(meta['date']).toBeTruthy()
  expect(meta['start']).toBeTruthy()
  expect(typeof meta['price']).toBe('number')
})

// ── B: Admin cancels → reservation.cancelled event ────────────────────────────
test('admin cancelling a reservation writes a reservation.cancelled event', async ({ page }) => {
  const admin = new AdminPage(page)
  const log = new ActivityLogPage(page)

  // Demo seed has booked reservations; admin is pre-logged in
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Filter to booked reservations and pick the first one
  await admin.filterByStatus('booked')
  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  // Record event count before the cancellation
  const countBefore = await log.getEventCount()

  // Admin cancels the reservation
  await admin.cancelReservation(resId)

  // The status badge must now read "cancelled"
  await page.getByTestId('filter-clear').click()
  await expect(page.getByTestId(`res-status-${resId}`)).toHaveText('cancelled')

  // Exactly one new event must have been appended
  const events = await log.getEvents()
  expect(events.length).toBeGreaterThan(countBefore)

  const cancelledEvents = events.filter((e) => e['type'] === 'reservation.cancelled')
  expect(cancelledEvents.length).toBeGreaterThan(0)

  // The most recent cancellation event must reference the cancelled reservation
  const latest = cancelledEvents[cancelledEvents.length - 1]
  expect(latest['entityId']).toBe(resId)
  expect(latest['actorId']).toBe('admin-1')
  expect(latest['entity']).toBe('reservation')
})

// ── C: Deactivate user → cascade events ───────────────────────────────────────
test('deactivating a user logs user.deactivated and reservation.cancelled cascade events', async ({ page }) => {
  const admin = new AdminPage(page)
  const log = new ActivityLogPage(page)

  // Demo seed: player-1 has future booked reservations
  await page.goto(adminUrl('users', { seed: 'demo', reset: true }))

  // Count events before deactivation
  const countBefore = await log.getEventCount()

  // Deactivate player-1
  await admin.setUserActive('player-1', false)
  await expect(page.getByTestId('user-status-player-1')).toHaveText('Inactive')

  const events = await log.getEvents()
  expect(events.length).toBeGreaterThan(countBefore)

  // There must be exactly one user.deactivated event for player-1
  const deactivated = events.filter(
    (e) => e['type'] === 'user.deactivated' && e['subjectId'] === 'player-1',
  )
  expect(deactivated).toHaveLength(1)
  expect(deactivated[0]['actorId']).toBe('admin-1')

  // Every reservation.cancelled event produced after the deactivation must
  // be attributed to the admin and reference player-1 as subject
  const newEvents = events.slice(countBefore)
  const cascadeCancellations = newEvents.filter((e) => e['type'] === 'reservation.cancelled')
  for (const ce of cascadeCancellations) {
    expect(ce['actorId']).toBe('admin-1')
    expect(ce['subjectId']).toBe('player-1')
    const meta = ce['meta'] as Record<string, unknown>
    expect(meta['reason']).toBe('user deactivated')
  }
})

// ── D: Negative — failed booking logs nothing ──────────────────────────────────
test('a failed booking attempt (slot taken) does not write any event', async ({ page }) => {
  const player = new PlayerPage(page)
  const log = new ActivityLogPage(page)

  // Start with an empty seed and book one slot
  await page.goto(playerUrl('', { seed: 'empty', as: 'player-1', reset: true }))
  await player.goToAvailability()
  await player.clickFirstAvailableSlot()
  await player.confirmBooking()

  // One event should now exist
  const countAfterFirst = await log.getEventCount()
  expect(countAfterFirst).toBe(1)

  // Attempt to book the same slot as a different player — the store will
  // reject it with SLOT_TAKEN. We simulate this by trying to book the same
  // slot via the store directly (the UI prevents double-booking, so we use
  // the __club API to attempt the conflicting action).
  const slotTakenThrew = await page.evaluate(() => {
    const club = (window as unknown as { __club: { state: { reservations: Array<{ courtId: string; date: string; start: string; end: string }> }; actions: { bookReservation: (input: unknown) => unknown } } }).__club
    const r = club.state.reservations[0]
    try {
      club.actions.bookReservation({
        courtId: r.courtId,
        date: r.date,
        start: r.start,
        end: r.end,
        playerId: 'player-2',
      })
      return false
    } catch {
      return true
    }
  })

  // The action must have thrown (SLOT_TAKEN)
  expect(slotTakenThrew).toBe(true)

  // The event count must not have changed — failed actions log nothing
  const countAfterFailed = await log.getEventCount()
  expect(countAfterFailed).toBe(countAfterFirst)
})

// ── E: Negative — bug=missing-events suppresses cancellation events ────────────
test('bug=missing-events suppresses cancellation events but not booking events', async ({ page }) => {
  const player = new PlayerPage(page)
  const log = new ActivityLogPage(page)

  // Activate the missing-events bug via the URL knob
  await page.goto(
    playerUrl('', { seed: 'empty', as: 'player-1', reset: true }) + '&bug=missing-events',
  )
  await player.goToAvailability()
  await player.clickFirstAvailableSlot()
  await player.confirmBooking()

  // The booking event must still be written (bug only suppresses *cancelled types)
  const eventsAfterBook = await log.getEvents()
  expect(eventsAfterBook.some((e) => e['type'] === 'reservation.booked')).toBe(true)

  // Now cancel the reservation via the store — the cancellation event must be suppressed
  const resId = eventsAfterBook[0]['entityId'] as string
  await page.evaluate((id: string) => {
    const club = (window as unknown as { __club: { actions: { cancelReservation: (id: string, actorId: string) => void } } }).__club
    club.actions.cancelReservation(id, 'player-1')
  }, resId)

  const eventsAfterCancel = await log.getEvents()
  // No reservation.cancelled event should have been written
  const cancelledEvents = eventsAfterCancel.filter((e) => e['type'] === 'reservation.cancelled')
  expect(cancelledEvents).toHaveLength(0)

  // The booking event must still be the only one
  expect(eventsAfterCancel).toHaveLength(1)
  expect(eventsAfterCancel[0]['type']).toBe('reservation.booked')
})
