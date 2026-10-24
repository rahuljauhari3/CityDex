/**
 * Central config + capability flags (design.md §2).
 *
 * Reads environment once and exposes typed flags. The app must never crash from
 * a missing key — absence of a key selects the demo/mock fallback instead
 * (REQ-1.3, REQ-1.6, REQ-1.7).
 *
 * This module is safe to import anywhere, but only the `NEXT_PUBLIC_*` values
 * are meaningful on the client. Secret-touching flags (Anthropic, service role,
 * provider secrets) are only read in server code.
 */

function hasValue(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** DEMO_MODE=true forces demo users + demo health provider + mock card. */
export const isDemoMode: boolean = process.env.DEMO_MODE === "true";

/** True when both public Supabase vars are present; otherwise use memoryStore. */
export const hasSupabase: boolean =
  hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** True when the service role key is present (server-only paths). */
export const hasSupabaseServiceRole: boolean = hasValue(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** True when an Anthropic key is present; otherwise use the mock card. */
export const hasAnthropic: boolean = hasValue(process.env.ANTHROPIC_API_KEY);

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
  hasAnthropic,
  hasStrava,
  hasWhoop,
  hasFitbit,
  appUrl,
} as const;

export type AppConfig = typeof config;
