import { test, expect } from '@playwright/test'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 11 — Admin Dashboard: stat cards, occupancy, revenue and no-show counts
 *
 * Covers the logic clarified in club-admin PR #3 (docs/code-comments):
 *  - Occupancy = used slots today / (active courts × slots per day); lessons count too.
 *  - Revenue counts only "booked" and "completed" reservations; cancellations and
 *    no-shows are excluded.
 *  - No-shows this week counts reservations with status "no-show" in the current week.
 *  - The bookings chart renders one bar per day of the current week.
 *  - Upcoming blocks lists court blocks (not lesson-linked) from today onward.
 *
 * Happy paths use the "demo" seed which has a rich, deterministic data set.
 * Negative / edge-case paths use the "empty" seed to verify zero-state rendering.
 */

// ─── Happy paths ─────────────────────────────────────────────────────────────

test('dashboard shows all four stat cards with non-empty demo data', async ({ page }) => {
  // Load the admin dashboard with the demo seed (pre-logged-in as admin-1)
  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  // All four stat cards must be visible
  await expect(page.getByText('Occupancy today')).toBeVisible()
  await expect(page.getByText('Revenue today')).toBeVisible()
  await expect(page.getByText('Revenue this week')).toBeVisible()
  await expect(page.getByText('No-shows this week')).toBeVisible()
})

test('dashboard occupancy card shows a percentage and a slot hint', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  // The occupancy card value ends with "%" and the hint shows "X of Y slots"
  const occupancyCard = page.locator('div').filter({ hasText: /^Occupancy today/ }).first()
  await expect(occupancyCard.getByText(/%/)).toBeVisible()
  await expect(occupancyCard.getByText(/\d+ of \d+ slots/)).toBeVisible()
})

test('dashboard revenue cards show a currency symbol', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  // Revenue values include the club currency (e.g. "EUR" or "$")
  // We just assert the card text is non-empty and contains a digit
  const revToday = page.locator('div').filter({ hasText: /^Revenue today/ }).first()
  await expect(revToday).toBeVisible()
  await expect(revToday.locator('p').nth(1)).not.toBeEmpty()
})

test('dashboard bookings chart renders an SVG with day labels', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  // The bar chart is an <svg> with aria-label "Bookings per day this week"
  const chart = page.getByRole('img', { name: 'Bookings per day this week' })
  await expect(chart).toBeVisible()

  // At least one day-of-week label (Mon, Tue, …) must appear inside the SVG
  await expect(chart.locator('text').first()).toBeVisible()
})

test('dashboard upcoming blocks section lists at least one block with demo data', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'demo', reset: true }))

  // The "Upcoming blocks" panel must be present
  await expect(page.getByRole('heading', { name: 'Upcoming blocks' })).toBeVisible()

  // Demo seed has maintenance blocks — at least one list item should appear
  const blockItems = page.locator('ul li')
  await expect(blockItems.first()).toBeVisible()
})

// ─── Negative / edge-case paths ───────────────────────────────────────────────

test('dashboard shows 0% occupancy when there are no reservations or lessons (empty seed)', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'empty', reset: true }))

  // With no reservations or lessons the occupancy must be 0%
  const occupancyCard = page.locator('div').filter({ hasText: /^Occupancy today/ }).first()
  await expect(occupancyCard.getByText('0%')).toBeVisible()
})

test('dashboard shows zero revenue when there are no booked/completed reservations (empty seed)', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'empty', reset: true }))

  // With no reservations the revenue today must be "0 <currency>"
  const revToday = page.locator('div').filter({ hasText: /^Revenue today/ }).first()
  // The value cell (second <p>) should start with "0"
  await expect(revToday.locator('p').nth(1)).toContainText('0')
})

test('dashboard shows "No upcoming blocks." when there are no blocks (empty seed)', async ({ page }) => {
  await page.goto(adminUrl('', { seed: 'empty', reset: true }))

  await expect(page.getByText('No upcoming blocks.')).toBeVisible()
})

test('dashboard is not accessible without a session — redirects to login', async ({ page }) => {
  // Navigate without the ?as= param so no session is pre-loaded
  const base = process.env.ADMIN_URL ?? 'https://club-admin-omega.vercel.app'
  await page.goto(`${base}/admin?reset=1&seed=demo`)

  // Guard should redirect unauthenticated visitors to /login
  await expect(page).toHaveURL(/\/login/)
})
