/**
 * URL helpers for the Baseline Tennis Club.
 *
 * Each sub-app is deployed independently on Vercel:
 *   Admin  → https://club-admin-omega.vercel.app/admin/...
 *   Coach  → https://club-coach-ten.vercel.app/coach/...
 *   Player → https://club-player.vercel.app/player/...
 *
 * Pass query params recognised by club-store to control the test environment:
 *   reset=1          — wipe and re-seed localStorage before mounting
 *   seed=demo|empty|full — which seed to use (default: demo)
 *   as=<userId>      — pre-login as this user (skips the login page)
 *   now=<ISO>        — override the clock (deterministic "today")
 *   bug=<name,...>   — activate named bugs
 */

export const FIXED_NOW = '2026-10-10T10:00:00'

const ADMIN_BASE  = process.env.ADMIN_URL  ?? 'https://club-admin-omega.vercel.app'
const COACH_BASE  = process.env.COACH_URL  ?? 'https://club-coach-ten.vercel.app'
const PLAYER_BASE = process.env.PLAYER_URL ?? 'https://club-player.vercel.app'

/** Build a query string from a plain object, omitting undefined values. */
function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  return entries.length ? '?' + new URLSearchParams(entries).toString() : ''
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function adminUrl(
  path: '' | 'calendar' | 'reservations' | 'courts' | 'users' | 'settings' = '',
  opts: { seed?: 'demo' | 'empty' | 'full'; as?: string; now?: string; reset?: boolean } = {},
): string {
  const { seed = 'demo', as = 'admin-1', now = FIXED_NOW, reset = true } = opts
  return `${ADMIN_BASE}/admin${path ? `/${path}` : ''}${qs({ reset: reset ? '1' : undefined, seed, as, now })}`
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function playerUrl(
  path: '' | 'reservations' | 'lessons' | 'notes' | 'rules' = '',
  opts: { seed?: 'demo' | 'empty' | 'full'; as?: string; now?: string; reset?: boolean } = {},
): string {
  const { seed = 'demo', as, now = FIXED_NOW, reset = false } = opts
  return `${PLAYER_BASE}/player${path ? `/${path}` : ''}${qs({ reset: reset ? '1' : undefined, seed, as, now })}`
}

// ─── Coach ────────────────────────────────────────────────────────────────────

export function coachUrl(
  path: '' | `lessons/${string}` | 'create' | 'students' = '',
  opts: { seed?: 'demo' | 'empty' | 'full'; as?: string; now?: string; reset?: boolean } = {},
): string {
  const { seed = 'demo', as, now = FIXED_NOW, reset = false } = opts
  return `${COACH_BASE}/coach${path ? `/${path}` : ''}${qs({ reset: reset ? '1' : undefined, seed, as, now })}`
}
