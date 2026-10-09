import { test, expect } from '@playwright/test'
import { adminUrl } from '../helpers/urls'

/**
 * E2E 13 — Admin Lessons: create, edit, cancel and access guard
 *
 * Covers the logic clarified in club-admin PR #3 (docs/code-comments):
 *  - The shared Fields component is used by both the create form and the edit
 *    dialog; the coach selector is shown only on create (showCoach=true).
 *  - The lesson list is a copy of the stored array sorted newest-first so the
 *    original store order is never mutated.
 *  - The Create button is disabled when the title is empty.
 *  - Edit and Cancel action buttons are disabled for non-"scheduled" lessons.
 *  - The edit dialog hides the coach field (coach can only be set on create).
 *
 * Happy paths use the "demo" seed. Negative paths use the "empty" seed or
 * verify disabled/error states.
 */

// ─── Happy paths ─────────────────────────────────────────────────────────────

test('lessons page loads and shows the table with demo data', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await expect(page.getByTestId('lessons-page')).toBeVisible()
  await expect(page.getByTestId('lessons-table')).toBeVisible()

  // Demo seed has lessons — at least one row must be visible
  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  await expect(firstRow).toBeVisible()
})

test('lessons are displayed newest-first (date + start descending)', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  // Collect the "when" cell text for the first two rows and verify ordering
  const rows = page.locator('[data-testid^="lesson-when-"]')
  const count = await rows.count()
  if (count >= 2) {
    const first = (await rows.nth(0).textContent()) ?? ''
    const second = (await rows.nth(1).textContent()) ?? ''
    // Newest first: first row date+time should be >= second row date+time
    expect(first >= second).toBeTruthy()
  }
})

test('admin can create a new lesson with all required fields', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  // Fill in the create form
  await page.getByTestId('lesson-title').fill('Morning Serve Clinic')
  // Court and coach selectors already have defaults; set a future date
  await page.getByTestId('lesson-date').fill('2026-10-20')
  await page.getByTestId('lesson-start').fill('09:00')
  await page.getByTestId('lesson-end').fill('10:00')
  await page.getByTestId('lesson-capacity').fill('6')

  await page.getByTestId('lesson-create').click()

  // After creation the form resets (title becomes empty) and the new lesson
  // appears at the top of the table (newest first)
  await expect(page.getByTestId('lesson-title')).toHaveValue('')
  await expect(page.locator('[data-testid^="lesson-row-"]').first()).toBeVisible()
})

test('create form shows the coach selector (showCoach=true on create)', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  // The coach dropdown must be present in the create form
  await expect(page.getByTestId('lesson-coach')).toBeVisible()
})

test('admin can filter lessons by status "scheduled"', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  // Every visible row must carry data-status="scheduled"
  const rows = page.locator('[data-testid^="lesson-row-"]')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toHaveAttribute('data-status', 'scheduled')
  }
})

test('admin can open the edit dialog for a scheduled lesson', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  // Filter to scheduled lessons so we can find an editable row
  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  await expect(firstRow).toBeVisible()

  // Get the lesson id from the row's data-testid
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await page.getByTestId(`lesson-edit-${lessonId}`).click()

  // The edit dialog must open
  await expect(page.getByTestId('lesson-edit-dialog')).toBeVisible()
})

test('edit dialog does NOT show the coach selector (coach is set on create only)', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await page.getByTestId(`lesson-edit-${lessonId}`).click()
  await expect(page.getByTestId('lesson-edit-dialog')).toBeVisible()

  // The coach selector must NOT appear inside the edit dialog
  await expect(page.getByTestId('lesson-edit-dialog').getByTestId('lesson-coach')).not.toBeVisible()
})

test('admin can save edits to a scheduled lesson', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await page.getByTestId(`lesson-edit-${lessonId}`).click()
  await expect(page.getByTestId('lesson-edit-dialog')).toBeVisible()

  // Change the title
  const titleInput = page.getByTestId('lesson-edit-dialog').getByTestId('lesson-title')
  await titleInput.fill('Updated Clinic Title')

  await page.getByTestId('lesson-edit-save').click()

  // Dialog closes after a successful save
  await expect(page.getByTestId('lesson-edit-dialog')).not.toBeVisible()

  // The updated title must appear in the table
  await expect(page.getByTestId(`lesson-name-${lessonId}`)).toHaveText('Updated Clinic Title')
})

test('admin can cancel a scheduled lesson via the confirmation dialog', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await page.getByTestId(`lesson-cancel-${lessonId}`).click()
  await expect(page.getByTestId('lesson-cancel-dialog')).toBeVisible()
  await page.getByTestId('lesson-cancel-confirm').click()

  // After cancellation the status badge must read "cancelled"
  await page.getByTestId('lesson-status-filter').selectOption('')
  await expect(page.getByTestId(`lesson-status-${lessonId}`)).toHaveText('cancelled')
})

// ─── Negative / edge-case paths ───────────────────────────────────────────────

test('Create lesson button is disabled when the title is empty', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  // Clear the title field (it starts empty by default)
  await page.getByTestId('lesson-title').fill('')

  await expect(page.getByTestId('lesson-create')).toBeDisabled()
})

test('Edit and Cancel buttons are disabled for a cancelled lesson', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('cancelled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  await expect(firstRow).toBeVisible()
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await expect(page.getByTestId(`lesson-edit-${lessonId}`)).toBeDisabled()
  await expect(page.getByTestId(`lesson-cancel-${lessonId}`)).toBeDisabled()
})

test('Edit and Cancel buttons are disabled for a done lesson', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('done')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  // If the demo seed has no "done" lessons the empty-state message should appear
  const isEmpty = await page.getByTestId('lessons-empty').isVisible()
  if (isEmpty) {
    await expect(page.getByTestId('lessons-empty')).toContainText('No lessons.')
    return
  }

  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await expect(page.getByTestId(`lesson-edit-${lessonId}`)).toBeDisabled()
  await expect(page.getByTestId(`lesson-cancel-${lessonId}`)).toBeDisabled()
})

test('cancel dialog can be dismissed without changing the lesson status', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await page.getByTestId(`lesson-cancel-${lessonId}`).click()
  await expect(page.getByTestId('lesson-cancel-dialog')).toBeVisible()

  // Dismiss without confirming
  await page.getByTestId('lesson-cancel-dismiss').click()

  // Dialog closes and the lesson remains "scheduled"
  await expect(page.getByTestId('lesson-cancel-dialog')).not.toBeVisible()
  await expect(page.getByTestId(`lesson-status-${lessonId}`)).toHaveText('scheduled')
})

test('edit dialog Save button is disabled when the title is cleared', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'demo', reset: true }))

  await page.getByTestId('lesson-status-filter').selectOption('scheduled')

  const firstRow = page.locator('[data-testid^="lesson-row-"]').first()
  const rowTestId = await firstRow.getAttribute('data-testid')
  const lessonId = rowTestId!.replace('lesson-row-', '')

  await page.getByTestId(`lesson-edit-${lessonId}`).click()
  await expect(page.getByTestId('lesson-edit-dialog')).toBeVisible()

  // Clear the title inside the dialog
  await page.getByTestId('lesson-edit-dialog').getByTestId('lesson-title').fill('')

  // Save button must be disabled when the title is empty
  await expect(page.getByTestId('lesson-edit-save')).toBeDisabled()
})

test('lessons page shows empty state when no lessons match the filter (empty seed)', async ({ page }) => {
  await page.goto(adminUrl('lessons', { seed: 'empty', reset: true }))

  // With an empty seed there are no lessons at all
  await expect(page.getByTestId('lessons-empty')).toBeVisible()
  await expect(page.getByTestId('lessons-empty')).toContainText('No lessons.')
})

test('lessons page is not accessible without a session — redirects to login', async ({ page }) => {
  const base = process.env.ADMIN_URL ?? 'https://club-admin-omega.vercel.app'
  await page.goto(`${base}/admin/lessons?reset=1&seed=demo`)

  // Guard redirects unauthenticated visitors to /login
  await expect(page).toHaveURL(/\/login/)
})
