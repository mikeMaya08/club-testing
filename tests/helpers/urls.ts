/**
 * URL helpers for the Baseline Tennis Club sandbox.
 *
 * All three sub-apps are proxied by the shell on the same origin so they share
 * localStorage. Pass query params recognised by club-store to control the
 * deterministic test environment:
 *
 *   reset=1          — wipe and re-seed localStorage before mounting
 *   seed=demo|empty|full — which seed to use (default: demo)
 *   as=<userId>      — pre-login as this user (skips the login page)
 *   now=<ISO>        — override the clock (deterministic "today")
 *   bug=<name,...>   — activate named bugs
 */

export const FIXED_NOW = '2026-10-10T10:00:00'

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
  return `/admin${path ? `/${path}` : ''}${qs({ reset: reset ? '1' : undefined, seed, as, now })}`
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function playerUrl(
  path: '' | 'reservations' | 'lessons' | 'notes' | 'rules' = '',
  opts: { seed?: 'demo' | 'empty' | 'full'; as?: string; now?: string; reset?: boolean } = {},
): string {
  const { seed = 'demo', as, now = FIXED_NOW, reset = false } = opts
  return `/player${path ? `/${path}` : ''}${qs({ reset: reset ? '1' : undefined, seed, as, now })}`
}

// ─── Coach ────────────────────────────────────────────────────────────────────

export function coachUrl(
  path: '' | `lessons/${string}` | 'create' | 'students' = '',
  opts: { seed?: 'demo' | 'empty' | 'full'; as?: string; now?: string; reset?: boolean } = {},
): string {
  const { seed = 'demo', as, now = FIXED_NOW, reset = false } = opts
  return `/coach${path ? `/${path}` : ''}${qs({ reset: reset ? '1' : undefined, seed, as, now })}`
}
