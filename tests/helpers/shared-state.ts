import { type Page } from '@playwright/test'

/**
 * The Club apps have no backend: their "database" is localStorage['club:v1'].
 * Each app is deployed on its own origin, so localStorage is not shared between
 * them in the test environment (in the club-shell proxy it is).
 *
 * These helpers carry the club state from one app origin to the next so a
 * multi-app journey can continue on the data created by the previous step.
 */
export const CLUB_STORAGE_KEY = 'club:v1'

/** Read the raw club state from the app currently open in `page`. */
export async function readClubState(page: Page): Promise<string> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), CLUB_STORAGE_KEY)
  if (!raw) throw new Error(`localStorage['${CLUB_STORAGE_KEY}'] is empty on ${page.url()}`)
  return raw
}

/** Write a club state captured elsewhere into the current origin and reload so the app picks it up. */
export async function writeClubState(page: Page, raw: string): Promise<void> {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [CLUB_STORAGE_KEY, raw] as const)
  await page.reload()
}
