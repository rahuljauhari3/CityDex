/**
 * Weekly friends challenges: everyone in your circle is in, progress comes
 * from health data already shared with friends. Group challenges add up;
 * "each" challenges count how many people finished. Pure.
 */

export interface MemberWeek {
  userId: string;
  username: string;
  avatarEmoji: string;
  steps: number;
  cardioMinutes: number;
  greenVisits: number;
  activeDays: number;
  isViewer: boolean;
}

export interface ChallengeRow {
  userId: string;
  username: string;
  avatarEmoji: string;
  value: number;
  pct: number;
  done: boolean;
  isViewer: boolean;
}

export interface Challenge {
  id: string;
  icon: string;
  title: string;
  description: string;
  mode: "group" | "each";
  unit: string;
  target: number;
  /** Group: total so far. Each: how many members finished. */
  progress: number;
  goal: number;
  pct: number;
  rows: ChallengeRow[];
}

function rows(members: MemberWeek[], value: (m: MemberWeek) => number, perMemberTarget: number): ChallengeRow[] {
  return members
    .map((m) => {
      const v = Math.round(value(m));
      return {
        userId: m.userId,
        username: m.username,
        avatarEmoji: m.avatarEmoji,
        value: v,
        pct: perMemberTarget > 0 ? Math.min(1, v / perMemberTarget) : 0,
        done: v >= perMemberTarget,
        isViewer: m.isViewer,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function weeklyChallenges(members: MemberWeek[]): Challenge[] {
  if (members.length === 0) return [];
  const n = members.length;

  // Group steps: 60,000 per member per week (~8,600/day; ~42 km of walking,
  // about a marathon each at a 0.7 m stride).
  const stepsTarget = 60_000 * n;
  const stepsTotal = members.reduce((s, m) => s + m.steps, 0);

  const cardioTarget = 150;
  const cardioRows = rows(members, (m) => m.cardioMinutes, cardioTarget);
  const cardioDone = cardioRows.filter((r) => r.done).length;

  const greenTarget = 2;
  const greenRows = rows(members, (m) => m.greenVisits, greenTarget);
  const greenDone = greenRows.filter((r) => r.done).length;

  return [
    {
      id: "group-steps",
      icon: "🥾",
      title: "A marathon each, together",
      description: `${(stepsTarget / 1000).toFixed(0)}K steps as a group this week (about 42 km per person)`,
      mode: "group",
      unit: "steps",
      target: stepsTarget,
      progress: Math.round(stepsTotal),
      goal: stepsTarget,
      pct: Math.min(1, stepsTotal / stepsTarget),
      rows: rows(members, (m) => m.steps, 60_000),
    },
    {
      id: "each-cardio",
      icon: "❤️",
      title: "150 Club",
      description: "Everyone logs 150 cardio minutes (zone 2+)",
      mode: "each",
      unit: "min",
      target: cardioTarget,
      progress: cardioDone,
      goal: n,
      pct: cardioDone / n,
      rows: cardioRows,
    },
    {
      id: "each-green",
      icon: "🌿",
      title: "Green breaks",
      description: "Everyone visits 2 parks or waterfront spots",
      mode: "each",
      unit: "visits",
      target: greenTarget,
      progress: greenDone,
      goal: n,
      pct: greenDone / n,
      rows: greenRows,
    },
  ];
}
