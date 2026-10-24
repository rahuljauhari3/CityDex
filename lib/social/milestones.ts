/**
 * Health milestones for the friends feed: derived (not stored) from badges,
 * daily totals, weekly cardio and place insights, with stable ids so friends
 * can high-five them. Pure. Celebrates effort; never shares location.
 */

import type { Profile, UserBadge } from "@/lib/db/types";
import { BADGES } from "@/lib/badges/rules";
import type { PlaceInsight } from "@/lib/insights/place";
import type { MergedDay } from "@/lib/health/summary";

export type MilestoneKind = "badge" | "steps10k" | "cardio150" | "insight";

export interface Milestone {
  id: string;
  userId: string;
  kind: MilestoneKind;
  icon: string;
  title: string;
  detail: string;
  at: string; // ISO
  isDemo: boolean;
}

/** `ms_<userId>_<kind>_<key>`: the owner is recoverable from the id. */
export function milestoneId(userId: string, kind: MilestoneKind, key: string): string {
  return `ms_${userId}_${kind}_${key}`;
}

export function milestoneOwner(id: string, userIds: string[]): string | null {
  if (!id.startsWith("ms_")) return null;
  // User ids can contain underscores, so match against known ids.
  return userIds.find((u) => id.startsWith(`ms_${u}_`)) ?? null;
}

export interface MilestoneInput {
  profile: Profile;
  badges: UserBadge[];
  /** This week's merged days, oldest first. */
  week: MergedDay[];
  insights: PlaceInsight[];
  weekStart: string;
  /** Only milestones at or after this time are kept. */
  since: number;
  guidelineMinutes?: number;
}

/** Noon Boston time on a YYYY-MM-DD date, as ISO. */
function noonOf(date: string): string {
  return new Date(`${date}T12:00:00-04:00`).toISOString();
}

export function buildMilestones(input: MilestoneInput): Milestone[] {
  const { profile, since } = input;
  const guideline = input.guidelineMinutes ?? 150;
  const out: Milestone[] = [];

  for (const b of input.badges) {
    const def = BADGES.find((d) => d.slug === b.badgeId);
    if (!def?.health) continue;
    out.push({
      id: milestoneId(profile.id, "badge", def.slug),
      userId: profile.id,
      kind: "badge",
      icon: def.icon,
      title: `earned ${def.name}`,
      detail: def.description,
      at: b.earnedAt,
      isDemo: profile.isDemo,
    });
  }

  for (const d of input.week) {
    if ((d.values.steps ?? 0) >= 10_000) {
      out.push({
        id: milestoneId(profile.id, "steps10k", d.date),
        userId: profile.id,
        kind: "steps10k",
        icon: "🥾",
        title: `walked ${Math.round(d.values.steps!).toLocaleString()} steps`,
        detail: "A 10K day.",
        at: noonOf(d.date),
        isDemo: d.isDemo,
      });
    }
  }

  let cumulative = 0;
  for (const d of input.week) {
    const before = cumulative;
    cumulative += d.values.zoneMinutes ?? 0;
    if (before < guideline && cumulative >= guideline) {
      out.push({
        id: milestoneId(profile.id, "cardio150", input.weekStart),
        userId: profile.id,
        kind: "cardio150",
        icon: "❤️",
        title: `hit ${guideline} cardio minutes this week`,
        detail: "That's the CDC's weekly activity guideline.",
        at: noonOf(d.date),
        isDemo: d.isDemo,
      });
    }
  }

  for (const i of input.insights) {
    if (i.deltaBpm > -3) continue;
    const latest = i.history.at(-1);
    if (!latest) continue;
    out.push({
      id: milestoneId(profile.id, "insight", i.placeId),
      userId: profile.id,
      kind: "insight",
      icon: "📉",
      title: `got fitter at ${i.placeName}`,
      detail: `Heart rate down ${Math.abs(i.deltaBpm)} bpm at the same pace over ${i.comparableVisits} visits.`,
      at: latest.date,
      isDemo: i.isDemo,
    });
  }

  return out.filter((m) => Date.parse(m.at) >= since && Date.parse(m.at) <= Date.now() + 60_000);
}

const PRIORITY: Record<MilestoneKind, number> = { insight: 0, cardio150: 1, steps10k: 2, badge: 3 };

/** Keep the feed readable: at most `perUser` milestones each, most meaningful first. */
export function capMilestones<T extends Milestone>(ms: T[], perUser = 3): T[] {
  const byUser = new Map<string, T[]>();
  for (const m of ms) byUser.set(m.userId, [...(byUser.get(m.userId) ?? []), m]);
  return [...byUser.values()].flatMap((list) =>
    list
      .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || b.at.localeCompare(a.at))
      .slice(0, perUser),
  );
}
