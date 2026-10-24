/**
 * Central config + capability flags (design.md §2).
 *
 * Reads environment once and exposes typed flags. The app must never crash from
 * a missing key — absence of a key selects the demo fallback instead
 * (REQ-1.3, REQ-1.6, REQ-1.7).
 *
 * This module is safe to import anywhere, but only the `NEXT_PUBLIC_*` values
 * are meaningful on the client. Secret-touching flags (service role, provider
 * secrets) are only read in server code.
 *
 * The app uses **no AI** — the stamp card is assembled from place data + the
 * uploaded photo, so there is no AI-runtime config here (tech.md, PLAN.md §6).
 */

function hasValue(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** True when both public Supabase vars are present; otherwise use memoryStore. */
export const hasSupabase: boolean =
  hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Demo mode (REQ-1.3, QA #1). Demo mode is **on by default** so the full flow
 * works with no keys. It is only off when `DEMO_MODE=false` is set explicitly
 * *and* Supabase is configured (a real backend to fall back to). If Supabase
 * is not configured, demo mode is always on regardless of `DEMO_MODE`, because
 * there is no other store to use.
 */
export const isDemoMode: boolean = (() => {
  const raw = process.env.DEMO_MODE?.trim().toLowerCase();
  if (raw === "false" && hasSupabase) return false;
  return true;
})();

/** True when the service role key is present (server-only paths). */
export const hasSupabaseServiceRole: boolean = hasValue(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** Real OAuth providers are enabled only when both client id + secret exist. */
export const hasStrava: boolean =
  hasValue(process.env.STRAVA_CLIENT_ID) &&
  hasValue(process.env.STRAVA_CLIENT_SECRET);

export const hasWhoop: boolean =
  hasValue(process.env.WHOOP_CLIENT_ID) &&
  hasValue(process.env.WHOOP_CLIENT_SECRET);

export const hasFitbit: boolean =
  hasValue(process.env.FITBIT_CLIENT_ID) &&
  hasValue(process.env.FITBIT_CLIENT_SECRET);

/** Base URL used for OAuth redirects. */
export const appUrl: string =
  process.env.APP_URL?.trim() || "http://localhost:3000";

export const config = {
  isDemoMode,
  hasSupabase,
  hasSupabaseServiceRole,
  hasStrava,
  hasWhoop,
  hasFitbit,
  appUrl,
} as const;

export type AppConfig = typeof config;
