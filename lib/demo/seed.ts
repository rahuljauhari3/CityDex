/**
 * Demo world (PLAN.md §12 M8): the demo user plus 6 demo users with a week of
 * check-ins, health snapshots, friendships, kudos and badges. Deterministic,
 * so the 2-minute demo script looks the same every run. Everything here is
 * synthetic and flagged `isDemo`.
 */

import type {
  Friendship,
  Goal,
  HealthConnection,
  Kudos,
  Place,
  Profile,
  Stamp,
  UserBadge,
} from "@/lib/db/types";
import { DEMO_USER_ID, DEMO_USERNAME } from "@/lib/demo-user";
import { evaluateBadges } from "@/lib/badges/rules";
import { demoDaily, demoRouteSnapshot, seededRandom } from "@/lib/health/demo";
import { DEFAULT_GOALS } from "@/lib/health/summary";
import { zone2Plus } from "@/lib/health/zones";
import { computePoints } from "@/lib/points/compute";
import { buildStampCard } from "@/lib/stamp/build";
import { addDays, nyDate } from "@/lib/time";
import { milestoneId } from "@/lib/social/milestones";

interface DemoPerson {
  id: string;
  username: string;
  emoji: string;
  age: number;
  hood: string;
  friend: "accepted" | "pending" | null;
  /** Seed place ids, oldest first. Days ago are spread across the week. */
  visits: { place: string; daysAgo: number; hour: number; km: number; run?: boolean; hrOffset?: number }[];
}

const PEOPLE: DemoPerson[] = [
  {
    id: DEMO_USER_ID, username: DEMO_USERNAME, emoji: "🧑‍🌾", age: 30, hood: "Back Bay", friend: null,
    visits: [
      // Repeat loop on the Esplanade at the same pace: HR trends down (REQ-16).
      { place: "seed_charles_esplanade", daysAgo: 13, hour: 7, km: 3.2, run: true, hrOffset: 6 },
      { place: "seed_public_garden", daysAgo: 11, hour: 18, km: 1.4 },
      // Two murals already, so collecting a third live unlocks Mural Hunter I.
      { place: "seed_graffiti_alley", daysAgo: 8, hour: 16, km: 2.3 },
      { place: "seed_charles_esplanade", daysAgo: 9, hour: 7, km: 3.2, run: true, hrOffset: 3 },
      { place: "seed_boston_common", daysAgo: 6, hour: 12, km: 1.1 },
      { place: "seed_charles_esplanade", daysAgo: 5, hour: 7, km: 3.2, run: true, hrOffset: 1 },
      { place: "seed_underground_ink_block", daysAgo: 3, hour: 17, km: 1.8 },
      { place: "seed_charles_esplanade", daysAgo: 1, hour: 7, km: 3.2, run: true, hrOffset: 0 },
    ],
  },
  {
    id: "demo_maya", username: "maya", emoji: "🦊", age: 27, hood: "North End", friend: "accepted",
    visits: [
      { place: "seed_dewey_square_mural", daysAgo: 6, hour: 8, km: 2.4 },
      { place: "seed_paul_revere_statue", daysAgo: 5, hour: 18, km: 1.2 },
      { place: "seed_greenway_carousel", daysAgo: 4, hour: 12, km: 1.6 },
      { place: "seed_graffiti_alley", daysAgo: 3, hour: 21, km: 5.1, run: true },
      { place: "seed_zakim_bridge", daysAgo: 2, hour: 7, km: 3.0, run: true },
      { place: "seed_mikes_pastry", daysAgo: 0, hour: 10, km: 0.9 },
    ],
  },
  {
    id: "demo_theo", username: "theo", emoji: "🐻", age: 34, hood: "South End", friend: "accepted",
    visits: [
      { place: "seed_dewey_square_mural", daysAgo: 6, hour: 17, km: 2.8 },
      { place: "seed_castle_island", daysAgo: 5, hour: 7, km: 6.2, run: true },
      { place: "seed_boston_harborwalk", daysAgo: 4, hour: 18, km: 2.2 },
      { place: "seed_ica_boston", daysAgo: 2, hour: 13, km: 1.9 },
      { place: "seed_underground_ink_block", daysAgo: 1, hour: 19, km: 1.3 },
    ],
  },
  {
    id: "demo_priya", username: "priya", emoji: "🦉", age: 29, hood: "Cambridge", friend: "accepted",
    visits: [
      { place: "seed_harvard_bridge", daysAgo: 6, hour: 6, km: 4.0, run: true },
      { place: "seed_mit_stata_center", daysAgo: 5, hour: 12, km: 1.5 },
      { place: "seed_dewey_square_mural", daysAgo: 4, hour: 18, km: 3.4 },
      { place: "seed_graffiti_alley", daysAgo: 3, hour: 19, km: 1.7 },
      { place: "seed_charles_esplanade", daysAgo: 2, hour: 7, km: 4.8, run: true },
      { place: "seed_arnold_arboretum", daysAgo: 1, hour: 9, km: 2.6 },
      { place: "seed_john_harvard_statue", daysAgo: 0, hour: 8, km: 1.0 },
    ],
  },
  {
    id: "demo_jordan", username: "jordan", emoji: "🐸", age: 41, hood: "Fenway", friend: "pending",
    visits: [
      { place: "seed_fenway_victory_gardens", daysAgo: 5, hour: 8, km: 1.4 },
      { place: "seed_citgo_sign", daysAgo: 3, hour: 20, km: 1.1 },
      { place: "seed_mfa_boston", daysAgo: 1, hour: 14, km: 2.0 },
    ],
  },
  {
    id: "demo_sam", username: "sam", emoji: "🐢", age: 52, hood: "Charlestown", friend: null,
    visits: [
      { place: "seed_bunker_hill_monument", daysAgo: 6, hour: 9, km: 1.6 },
      { place: "seed_uss_constitution", daysAgo: 4, hour: 11, km: 1.2 },
      { place: "seed_rose_kennedy_greenway", daysAgo: 2, hour: 16, km: 2.5 },
      { place: "seed_boston_common", daysAgo: 0, hour: 9, km: 2.1 },
    ],
  },
  {
    id: "demo_lee", username: "lee", emoji: "🐰", age: 23, hood: "Back Bay", friend: null,
    visits: [
      { place: "seed_copley_square", daysAgo: 6, hour: 12, km: 0.8 },
      { place: "seed_boston_public_library", daysAgo: 5, hour: 15, km: 0.6 },
      { place: "seed_pru_skywalk", daysAgo: 3, hour: 22, km: 1.3 },
      { place: "seed_esplanade_hatch_shell", daysAgo: 2, hour: 7, km: 5.5, run: true },
      { place: "seed_newbury_street", daysAgo: 1, hour: 13, km: 1.0 },
      { place: "seed_acorn_street", daysAgo: 0, hour: 11, km: 1.9 },
    ],
  },
];

export interface DemoWorld {
  profiles: Profile[];
  stamps: Stamp[];
  goals: Map<string, Goal[]>;
  friendships: Friendship[];
  kudos: Kudos[];
  userBadges: UserBadge[];
  connections: HealthConnection[];
}

/** A Boston-local timestamp `daysAgo` days before `now`, at `hour`. */
function at(now: Date, daysAgo: number, hour: number, minute: number): Date {
  const date = addDays(nyDate(now), -daysAgo);
  // Boston is UTC-4 in summer and UTC-5 in winter; -4 is close enough for demo data.
  const d = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`);
  // Never seed into the future.
  return d.getTime() > now.getTime() ? new Date(now.getTime() - (daysAgo + 1) * 3_600_000) : d;
}

export function buildDemoWorld(places: Place[], now: Date): DemoWorld {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const collectCounts = new Map<string, number>();
  const profiles: Profile[] = [];
  const stamps: Stamp[] = [];
  const goals = new Map<string, Goal[]>();
  const friendships: Friendship[] = [];
  const connections: HealthConnection[] = [];
  const userBadges: UserBadge[] = [];

  // Seed every visit in global time order so "first discoverer" is correct.
  const allVisits = PEOPLE.flatMap((person) => person.visits.map((v, i) => ({ person, v, i })));
  const rand = seededRandom("citydex-demo-world");
  const timed = allVisits
    .map((x) => ({ ...x, t: at(now, x.v.daysAgo, x.v.hour, Math.floor(rand() * 50)) }))
    .sort((a, b) => a.t.getTime() - b.t.getTime());

  for (const { person, v, i, t } of timed) {
    const place = placeById.get(v.place);
    if (!place) continue;
    const prior = collectCounts.get(place.id) ?? 0;
    collectCounts.set(place.id, prior + 1);
    const distanceM = v.km * 1000;
    const minPerKm = v.run ? 6.2 : 12.5;
    const from = new Date(t.getTime() - v.km * minPerKm * 60_000);
    const snapshot = demoRouteSnapshot({
      seed: `${person.id}:${i}`,
      from,
      to: t,
      distanceM,
      hrOffset: v.hrOffset,
    });
    if (v.hrOffset !== undefined) {
      // Hold pace exactly constant on the repeat loop so the trend is clean.
      snapshot.durationMin = Math.round(v.km * minPerKm);
    }
    const repeat = stamps.some((s) => s.userId === person.id && s.placeId === place.id);
    const card = buildStampCard({
      source: "seed",
      name: place.name,
      category: place.category,
      baselineRarity: place.baselineRarity,
      priorCollectCount: prior,
    });
    const breakdown = computePoints({
      rarity: card.rarity,
      firstDiscoverer: prior === 0,
      steps: snapshot.steps ?? 0,
      zone2PlusMinutes: zone2Plus(snapshot.hrZoneMinutes),
      recommended: false,
      repeatVisit: repeat,
    });
    stamps.push({
      id: `stamp_demo_${person.username}_${i}`,
      userId: person.id,
      placeId: place.id,
      routeId: null,
      photoPath: null,
      card,
      rarity: card.rarity,
      points: breakdown.total,
      pointsBreakdown: breakdown,
      healthSnapshot: snapshot,
      createdAt: t.toISOString(),
    });
  }

  const today = nyDate(now);
  for (const person of PEOPLE) {
    profiles.push({
      id: person.id,
      username: person.username,
      avatarUrl: null,
      avatarEmoji: person.emoji,
      homeNeighborhood: person.hood,
      showRouteMap: false,
      createdAt: at(now, 14, 9, 0).toISOString(),
      age: person.age,
      inviteCode: `CDX-${person.username.toUpperCase().slice(0, 4)}`,
      consentedAt: person.id === DEMO_USER_ID ? null : at(now, 14, 9, 5).toISOString(),
      onboardedAt: person.id === DEMO_USER_ID ? null : at(now, 14, 9, 5).toISOString(),
      isDemo: true,
    });
    goals.set(
      person.id,
      DEFAULT_GOALS.map((goal) => ({ ...goal, id: `goal_${person.id}_${goal.type}`, userId: person.id })),
    );
    connections.push({ userId: person.id, provider: "demo", connectedAt: at(now, 14, 9, 6).toISOString() });
    if (person.friend) {
      // Pending requests come *from* the demo person, so "you" can accept them.
      friendships.push({
        userId: person.id,
        friendId: DEMO_USER_ID,
        status: person.friend,
        createdAt: at(now, 10, 12, 0).toISOString(),
      });
    }

    const mine = stamps.filter((s) => s.userId === person.id);
    const daily = Array.from({ length: 14 }, (_, k) => demoDaily(person.id, addDays(today, -k), 1, k));
    for (const slug of evaluateBadges({ stamps: mine, places: placeById, daily })) {
      userBadges.push({ userId: person.id, badgeId: slug, earnedAt: mine.at(-1)?.createdAt ?? now.toISOString() });
    }
  }

  // Friends high-five each other's recent stamps.
  const kudos: Kudos[] = [];
  const friendIds = ["demo_maya", "demo_theo", "demo_priya"];
  for (const s of stamps) {
    if (Date.parse(s.createdAt) < now.getTime() - 7 * 86_400_000) continue;
    for (const fid of [...friendIds, DEMO_USER_ID]) {
      if (fid === s.userId) continue;
      if (fid === DEMO_USER_ID && !friendIds.includes(s.userId)) continue;
      if (fid !== DEMO_USER_ID && s.userId !== DEMO_USER_ID && !friendIds.includes(s.userId)) continue;
      if (seededRandom(`${s.id}:${fid}`)() < (fid === DEMO_USER_ID ? 0.3 : 0.6)) {
        kudos.push({ stampId: s.id, userId: fid, createdAt: s.createdAt });
      }
    }
  }

  // Friends cheer your Esplanade fitness milestone (see lib/social/milestones).
  const esplanadeMilestone = milestoneId(DEMO_USER_ID, "insight", "seed_charles_esplanade");
  for (const fid of ["demo_maya", "demo_priya"]) {
    kudos.push({ stampId: esplanadeMilestone, userId: fid, createdAt: now.toISOString() });
  }

  return { profiles, stamps, goals, friendships, kudos, userBadges, connections };
}
