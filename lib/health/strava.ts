/**
 * Strava provider (PLAN.md §4, P1). Web OAuth 2.0, scope activity:read_all.
 * Activities give distance, moving time, average/max HR and calories.
 * Server-only: tokens never reach the client.
 */

import "server-only";
import type { DailyHealth, HealthConnection, HealthSnapshot } from "@/lib/db/types";
import { appUrl } from "@/lib/config";
import { decrypt, encrypt } from "@/lib/crypto";
import { nyDate } from "@/lib/time";

const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

export function stravaRedirectUri(): string {
  return `${appUrl}/api/health/strava/callback`;
}

export function stravaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: stravaRedirectUri(),
    approval_prompt: "auto",
    scope: "activity:read_all",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeStravaCode(userId: string, code: string, scope: string | null): Promise<HealthConnection> {
  const t = await tokenRequest({ code, grant_type: "authorization_code" });
  return {
    userId,
    provider: "strava",
    connectedAt: new Date().toISOString(),
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: encrypt(t.refresh_token),
    expiresAt: new Date(t.expires_at * 1000).toISOString(),
    scopes: scope ?? t.scope ?? "activity:read_all",
  };
}

/** Returns a valid access token, refreshing it if needed (and the updated connection). */
async function accessToken(conn: HealthConnection): Promise<{ token: string; conn: HealthConnection }> {
  if (conn.accessTokenEnc && conn.expiresAt && Date.parse(conn.expiresAt) > Date.now() + 60_000) {
    return { token: decrypt(conn.accessTokenEnc), conn };
  }
  if (!conn.refreshTokenEnc) throw new Error("Strava connection has no refresh token");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(conn.refreshTokenEnc) });
  const next: HealthConnection = {
    ...conn,
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: encrypt(t.refresh_token),
    expiresAt: new Date(t.expires_at * 1000).toISOString(),
  };
  return { token: t.access_token, conn: next };
}

interface StravaActivity {
  id: number;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kilojoules?: number;
  calories?: number;
}

async function activities(token: string, from: Date, to: Date): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    after: String(Math.floor(from.getTime() / 1000)),
    before: String(Math.ceil(to.getTime() / 1000)),
    per_page: "50",
  });
  const res = await fetch(`${API}/athlete/activities?${params}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Strava activities failed (${res.status})`);
  return (await res.json()) as StravaActivity[];
}

function kcalOf(a: StravaActivity): number | undefined {
  if (a.calories) return a.calories;
  // Rides report kJ of work; ~1 kcal burned per kJ at typical efficiency.
  return a.kilojoules ? Math.round(a.kilojoules) : undefined;
}

export async function stravaSnapshot(
  conn: HealthConnection,
  from: Date,
  to: Date,
): Promise<{ snapshot: HealthSnapshot | null; conn: HealthConnection }> {
  const { token, conn: next } = await accessToken(conn);
  const list = await activities(token, from, to);
  if (!list.length) return { snapshot: null, conn: next };
  const hr = list.filter((a) => a.average_heartrate);
  const kcal = list.map(kcalOf).filter((k): k is number => k !== undefined);
  return {
    conn: next,
    snapshot: {
      source: "strava",
      from: from.toISOString(),
      to: to.toISOString(),
      isDemo: false,
      distanceM: Math.round(list.reduce((s, a) => s + a.distance, 0)),
      durationMin: Math.round(list.reduce((s, a) => s + a.moving_time, 0) / 60),
      hrAvg: hr.length ? Math.round(hr.reduce((s, a) => s + a.average_heartrate!, 0) / hr.length) : undefined,
      hrMax: hr.length ? Math.round(Math.max(...hr.map((a) => a.max_heartrate ?? a.average_heartrate!))) : undefined,
      activeKcal: kcal.length ? Math.round(kcal.reduce((s, k) => s + k, 0)) : undefined,
    },
  };
}

export async function stravaDaily(conn: HealthConnection, from: Date, to: Date): Promise<{ days: DailyHealth[]; conn: HealthConnection }> {
  const { token, conn: next } = await accessToken(conn);
  const list = await activities(token, from, to);
  const byDay = new Map<string, DailyHealth>();
  for (const a of list) {
    const date = nyDate(new Date(a.start_date));
    const d = byDay.get(date) ?? { date, source: "strava" as const, isDemo: false, activeKcal: 0 };
    d.activeKcal = (d.activeKcal ?? 0) + (kcalOf(a) ?? 0);
    byDay.set(date, d);
  }
  return { days: [...byDay.values()], conn: next };
}

export async function revokeStrava(conn: HealthConnection): Promise<void> {
  if (!conn.accessTokenEnc) return;
  try {
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { authorization: `Bearer ${decrypt(conn.accessTokenEnc)}` },
    });
  } catch {
    // Tokens are deleted locally either way.
  }
}
