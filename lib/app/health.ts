/**
 * Health data service: combines every connected provider into daily totals
 * and check-in snapshots (PLAN.md §4). Server-only.
 */

import "server-only";
import { getStore } from "@/lib/db";
import type { DailyHealth, HealthConnection, HealthSnapshot } from "@/lib/db/types";
import { appleDaily, appleSnapshot } from "@/lib/health/apple";
import { demoDaily, demoRouteSnapshot } from "@/lib/health/demo";
import { mergeSnapshots } from "@/lib/health/merge";
import { stravaDaily, stravaSnapshot } from "@/lib/health/strava";
import { mergeDaily, type MergedDay } from "@/lib/health/summary";
import { estimateSteps } from "@/lib/geo";
import { estimatedMaxHr } from "@/lib/health/zones";
import { nyDate, nyDayProgress } from "@/lib/time";

function has(conns: HealthConnection[], provider: HealthConnection["provider"]) {
  return conns.find((c) => c.provider === provider) ?? null;
}

/** Merged daily totals for each date, from every connected provider. */
export async function dailyFor(userId: string, dates: string[]): Promise<MergedDay[]> {
  const store = getStore();
  const conns = await store.getConnections(userId);
  const rows: DailyHealth[] = [];
  const today = nyDate(new Date());

  if (has(conns, "demo")) {
    for (const date of dates) {
      if (date > today) continue;
      rows.push(demoDaily(userId, date, date === today ? nyDayProgress(new Date()) : 1));
    }
  }
  if (has(conns, "apple_export")) {
    const set = new Set(dates);
    rows.push(...appleDaily(await store.getAppleRecords(userId)).filter((d) => set.has(d.date)));
  }
  const strava = has(conns, "strava");
  if (strava && dates.length) {
    try {
      const sorted = [...dates].sort();
      const { days, conn } = await stravaDaily(
        strava,
        new Date(`${sorted[0]}T00:00:00-05:00`),
        new Date(`${sorted.at(-1)}T23:59:59-04:00`),
      );
      await store.saveConnection(conn);
      rows.push(...days);
    } catch (err) {
      console.warn("[health] Strava daily fetch failed:", (err as Error).message);
    }
  }
  return dates.map((date) => mergeDaily(date, rows));
}

export interface CheckinRoute {
  from: Date;
  to: Date;
  distanceM: number;
}

/** Health snapshot for the check-in window `[route start … now]`. */
export async function checkinSnapshot(userId: string, route: CheckinRoute, seed: string): Promise<HealthSnapshot | null> {
  const store = getStore();
  const conns = await store.getConnections(userId);
  const profile = await store.getProfile(userId);
  const maxHr = estimatedMaxHr(profile?.age ?? undefined);
  const snaps: (HealthSnapshot | null)[] = [];

  // Browser route tracking: distance is real, steps are estimated.
  if (route.distanceM > 0) {
    snaps.push({
      source: "demo",
      from: route.from.toISOString(),
      to: route.to.toISOString(),
      distanceM: Math.round(route.distanceM),
      steps: estimateSteps(route.distanceM),
      stepsEstimated: true,
      durationMin: Math.round((route.to.getTime() - route.from.getTime()) / 60_000),
      isDemo: false,
    });
  }
  if (has(conns, "demo")) {
    snaps.push(demoRouteSnapshot({ seed, from: route.from, to: route.to, distanceM: route.distanceM, maxHr }));
  }
  if (has(conns, "apple_export")) {
    snaps.push(appleSnapshot(await store.getAppleRecords(userId), route.from, route.to, maxHr));
  }
  const strava = has(conns, "strava");
  if (strava) {
    try {
      const { snapshot, conn } = await stravaSnapshot(strava, route.from, route.to);
      await store.saveConnection(conn);
      snaps.push(snapshot);
    } catch (err) {
      console.warn("[health] Strava snapshot failed:", (err as Error).message);
    }
  }
  return mergeSnapshots(snaps);
}
