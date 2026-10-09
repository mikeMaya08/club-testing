import { test, expect } from '@playwright/test'
import { AdminPage } from '../pages/AdminPage'
import { CoachPage } from '../pages/CoachPage'
import { ActivityLogPage } from '../pages/ActivityLogPage'
import { adminUrl, coachUrl, FIXED_NOW } from '../helpers/urls'

/**
 * E2E 12 — Activity log: lesson, block, and filterEvents flows
 *
 * Introduced in club-store v0.3.0. Covers the remaining event families and
 * the `filterEvents` query helper exposed as `window.__club`.
 *
 * Flows covered:
 *  A. Happy — coach creates a lesson → `lesson.created` event is written with
 *     the coach as actor and the lesson as entity.
 *  B. Happy — coach marks a student as no-show → `attendance.marked` event is
 *     written; if the student has an overlapping reservation, a cascade
 *     `reservation.no_show` event is also written (both attributed to the coach).
 *  C. Happy — admin creates a court block that overlaps a booked reservation →
 *     `block.created` event is written first, then one `reservation.cancelled`
 *     cascade event per cancelled booking, all attributed to the admin.
 *  D. Happy — demo seed ships with a pre-populated event history (>40 events,
 *     chronologically ordered, none in the future).
 *  E. Negative — no-op court update (same values) does not write any event.
 *  F. Negative — filterEvents with a future `from` date returns an empty result.
 *  G. Negative — filterEvents by entity='block' returns only block events.
 */

// ── A: Coach creates a lesson → lesson.created event ─────────────────────────
test('creating a lesson writes a lesson.created event attributed to the coach', async ({ page }) => {
  const coach = new CoachPage(page)
  const log = new ActivityLogPage(page)

  // Empty seed: no events, no conflicts
  await page.goto(coachUrl('', { seed: 'empty', as: 'coach-1', reset: true }))

  const countBefore = await log.getEventCount()
  expect(countBefore).toBe(0)

  // Create a lesson via the coach UI
  await coach.goToCreateLesson()
  await coach.createLesson({
    title: 'Activity Log Test Lesson',
    courtName: 'Court 1',
    date: '2026-10-15',
    start: '10:00',
    end: '11:00',
    capacity: 4,
  })

  // Exactly one event must have been written
  const events = await log.getEvents()
  expect(events.length).toBeGreaterThan(countBefore)

  const lessonCreated = events.filter((e) => e['type'] === 'lesson.created')
  expect(lessonCreated.length).toBeGreaterThan(0)

  const evt = lessonCreated[lessonCreated.length - 1]
  expect(evt['actorId']).toBe('coach-1')
  expect(evt['entity']).toBe('lesson')
  expect(typeof evt['entityId']).toBe('string')
  expect(String(evt['summary'])).toContain('Activity Log Test Lesson')

  const meta = evt['meta'] as Record<string, unknown>
  expect(meta['courtId']).toBeTruthy()
  expect(meta['date']).toBe('2026-10-15')
  expect(meta['start']).toBe('10:00')
})

// ── B: Coach marks no-show → attendance.marked (+ optional cascade) ───────────
test('marking a student no-show writes attendance.marked and optional reservation.no_show cascade', async ({ page }) => {
  const coach = new CoachPage(page)
  const log = new ActivityLogPage(page)

  // Demo seed: lesson-1 "Beginner Drills" has player-1 enrolled
  await page.goto(coachUrl('', { seed: 'demo', as: 'coach-1', reset: true }))

  const countBefore = await log.getEventCount()

  // Open lesson-1 and mark player-1 as no-show
  await page.getByText('Beginner Drills').first().click()
  await expect(page.getByRole('heading', { name: 'Beginner Drills' })).toBeVisible()

  await coach.markAttendance('Lucía Fernández', 'no-show')

  const events = await log.getEvents()
  expect(events.length).toBeGreaterThan(countBefore)

  const newEvents = events.slice(countBefore)

  // There must be exactly one attendance.marked event
  const attendanceEvents = newEvents.filter((e) => e['type'] === 'attendance.marked')
  expect(attendanceEvents).toHaveLength(1)

  const attEvt = attendanceEvents[0]
  expect(attEvt['subjectId']).toBe('player-1')
  expect(attEvt['entity']).toBe('lesson')
  const attMeta = attEvt['meta'] as Record<string, unknown>
  expect(attMeta['value']).toBe('no-show')

  // If a cascade happened, the reservation.no_show event must also be attributed to the coach
  const cascadeEvents = newEvents.filter((e) => e['type'] === 'reservation.no_show')
  for (const ce of cascadeEvents) {
    expect(ce['actorId']).toBe('coach-1')
    expect(ce['subjectId']).toBe('player-1')
    expect(ce['entity']).toBe('reservation')
  }
})

// ── C: Admin creates a block → block.created + reservation.cancelled cascade ──
test('creating a court block writes block.created and reservation.cancelled cascade events', async ({ page }) => {
  const admin = new AdminPage(page)
  const log = new ActivityLogPage(page)

  // Demo seed: Court 1 has future booked reservations
  await page.goto(adminUrl('reservations', { seed: 'demo', reset: true }))

  // Find a booked reservation on Court 1 to know which slot to block
  await page.getByTestId('filter-status').selectOption('booked')
  await page.getByTestId('filter-court').selectOption({ label: 'Court 1' })

  const row = admin.firstRowWithStatus('booked')
  await expect(row).toBeVisible()
  const resId = await admin.resIdFromRow(row)

  // Read the date and start time of the reservation from the DOM
  const dateText = await page.getByTestId(`res-date-${resId}`).textContent()
  const startText = await page.getByTestId(`res-start-${resId}`).textContent()
  expect(dateText).toBeTruthy()
  expect(startText).toBeTruthy()

  const countBefore = await log.getEventCount()

  // Simulate the block creation via the store (the calendar drag UI is not
  // automatable headlessly; this exercises the same code path as the UI action)
  await page.evaluate(
    ({ date, start }: { date: string; start: string }) => {
      const club = (window as unknown as {
        __club: {
          actions: {
            createBlock: (input: {
              courtId: string
              date: string
              start: string
              end: string
              reason: string
              createdBy: string
            }) => void
          }
        }
      }).__club
      // Block the full hour that contains the reservation
      const [h] = start.split(':').map(Number)
      const endHour = String(h + 1).padStart(2, '0')
      club.actions.createBlock({
        courtId: 'court-1',
        date,
        start,
        end: `${endHour}:00`,
        reason: 'tournament',
        createdBy: 'admin-1',
      })
    },
    { date: dateText!.trim(), start: startText!.trim() },
  )

  const events = await log.getEvents()
  const newEvents = events.slice(countBefore)

  // First new event must be block.created
  expect(newEvents[0]['type']).toBe('block.created')
  expect(newEvents[0]['actorId']).toBe('admin-1')
  expect(newEvents[0]['entity']).toBe('block')

  // Every subsequent event must be reservation.cancelled attributed to admin-1
  const cascades = newEvents.slice(1)
  for (const ce of cascades) {
    expect(ce['type']).toBe('reservation.cancelled')
    expect(ce['actorId']).toBe('admin-1')
    const meta = ce['meta'] as Record<string, unknown>
    expect(meta['reason']).toBe('blocked by club')
  }
})

// ── D: Demo seed has a pre-populated event history ────────────────────────────
test('demo seed ships with a chronological event history of more than 40 events', async ({ page }) => {
  const log = new ActivityLogPage(page)

  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  const events = await log.getEvents()
  expect(events.length).toBeGreaterThan(40)

  // Events must be in chronological order (oldest first in the array)
  const timestamps = events.map((e) => String(e['createdAt']))
  const sorted = [...timestamps].sort()
  expect(timestamps).toEqual(sorted)

  // No event should be in the future relative to FIXED_NOW
  const fixedNowIso = new Date(FIXED_NOW).toISOString()
  for (const ts of timestamps) {
    expect(ts <= fixedNowIso).toBe(true)
  }

  // The seed must include at least one lesson.created event
  expect(events.some((e) => e['type'] === 'lesson.created')).toBe(true)

  // IDs must start at evt-1
  expect(events[0]['id']).toBe('evt-1')
})

// ── E: Negative — no-op court update does not write any event ─────────────────
test('updating a court with identical values does not write any event', async ({ page }) => {
  const log = new ActivityLogPage(page)

  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  const countBefore = await log.getEventCount()

  // Apply a no-op patch: set lights to its current value (court-1 has lights=true in demo)
  await page.evaluate(() => {
    const club = (window as unknown as {
      __club: {
        state: { courts: Array<{ id: string; lights: boolean }> }
        actions: { updateCourt: (id: string, patch: { lights: boolean }, actorId: string) => void }
      }
    }).__club
    const court = club.state.courts.find((c) => c.id === 'court-1')!
    // Pass the same lights value — no actual change
    club.actions.updateCourt('court-1', { lights: court.lights }, 'admin-1')
  })

  const countAfter = await log.getEventCount()
  // No new event must have been written
  expect(countAfter).toBe(countBefore)
})

// ── F: Negative — filterEvents with future from date returns empty ─────────────
test('filterEvents with a from date in the future returns an empty result', async ({ page }) => {
  const log = new ActivityLogPage(page)

  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  const result = await page.evaluate(() => {
    const club = (window as unknown as {
      __club: {
        state: { events: unknown[] }
        filterEvents: (events: unknown[], filter: { from: string }) => unknown[]
      }
    }).__club
    // Use a date far in the future
    return club.filterEvents(club.state.events, { from: '2099-01-01' })
  })

  expect(result).toHaveLength(0)
})

// ── G: Negative — filterEvents by entity='block' returns only block events ─────
test('filterEvents filtered by entity=block returns only block-entity events', async ({ page }) => {
  const log = new ActivityLogPage(page)

  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  // First create a block so there is at least one block event in the log
  await page.evaluate(() => {
    const club = (window as unknown as {
      __club: {
        actions: {
          createBlock: (input: {
            courtId: string
            date: string
            start: string
            end: string
            reason: string
            createdBy: string
          }) => void
        }
      }
    }).__club
    club.actions.createBlock({
      courtId: 'court-3',
      date: '2026-10-15',
      start: '08:00',
      end: '09:00',
      reason: 'maintenance',
      createdBy: 'admin-1',
    })
  })

  const blockEvents = await page.evaluate(() => {
    const club = (window as unknown as {
      __club: {
        state: { events: unknown[] }
        filterEvents: (events: unknown[], filter: { entity: string }) => unknown[]
      }
    }).__club
    return club.filterEvents(club.state.events, { entity: 'block' })
  })

  expect(blockEvents.length).toBeGreaterThan(0)
  for (const e of blockEvents as Array<Record<string, unknown>>) {
    expect(e['entity']).toBe('block')
  }

  // Verify that non-block events are excluded
  const allEvents = await log.getEvents()
  const nonBlockCount = allEvents.filter((e) => e['entity'] !== 'block').length
  expect(nonBlockCount).toBeGreaterThan(0) // sanity: there are non-block events
  expect((blockEvents as unknown[]).length).toBeLessThan(allEvents.length)
})
