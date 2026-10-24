/**
 * Leaderboards (PLAN.md §7): global/friends × week/all time × steps/points/
 * stamps. Rows carry only username, avatar, value and rank. Never location
 * or routes.
 */

import type { LeaderboardMetric, LeaderboardRow, Profile, Stamp } from "@/lib/db/types";

export interface LeaderboardInput {
  profiles: Profile[];
  stamps: Stamp[];
  /** Steps per user for the window (from daily health totals). */
  steps: Map<string, number>;
  /** Same metric for the previous window, used for the rank-change arrow. */
  previous?: Map<string, number>;
  metric: LeaderboardMetric;
}

export function metricValues(stamps: Stamp[], steps: Map<string, number>, metric: LeaderboardMetric, userIds: string[]): Map<string, number> {
  const values = new Map<string, number>(userIds.map((id) => [id, 0]));
  if (metric === "steps") {
    for (const id of userIds) values.set(id, Math.round(steps.get(id) ?? 0));
  } else {
    for (const s of stamps) {
      if (!values.has(s.userId)) continue;
      values.set(s.userId, values.get(s.userId)! + (metric === "points" ? s.points : 1));
    }
  }
  return values;
}

function ranks(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const out = new Map<string, number>();
  sorted.forEach(([id, v], i) => {
    const prev = sorted[i - 1];
    out.set(id, prev && prev[1] === v ? out.get(prev[0])! : i + 1);
  });
  return out;
}

export function buildLeaderboard(input: LeaderboardInput): LeaderboardRow[] {
  const ids = input.profiles.map((p) => p.id);
  const values = metricValues(input.stamps, input.steps, input.metric, ids);
  const now = ranks(values);
  const before = input.previous ? ranks(input.previous) : null;
  return input.profiles
    .map((p) => ({
      userId: p.id,
      username: p.username,
      avatarUrl: p.avatarUrl,
      value: values.get(p.id) ?? 0,
      rank: now.get(p.id) ?? ids.length,
      rankChange: before ? (before.get(p.id) ?? ids.length) - (now.get(p.id) ?? ids.length) : 0,
    }))
    .sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username));
}
