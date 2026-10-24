import type { HealthSnapshot } from "@/lib/db/types";
import type { GoalImpact, UsualComparison } from "@/lib/health/checkin";
import { DemoChip, EnergyBar, HealthStats } from "@/components/health/HealthBits";
import { Sparkline } from "@/components/health/Sparkline";

export interface CheckinHealthContext {
  paceMinPerKm: number | null;
  goalImpact: GoalImpact[];
  usual: UsualComparison | null;
  placeInsight: { text: string; history: { date: string; hr: number; comparable: boolean }[]; visits: number } | null;
}

const GOAL_COLOR: Record<string, string> = { steps: "#6daa2c", active_kcal: "#fc5200", zone_minutes: "#c0392b" };

function pace(p: number): string {
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")} /km`;
}

/**
 * "What this walk did": the health snapshot plus, when known, what it added to
 * today's goals and how it compares with your usual walks or earlier visits.
 */
export function StampHealthCard({ snapshot, context }: { snapshot: HealthSnapshot; context?: CheckinHealthContext | null }) {
  const p = context?.paceMinPerKm ?? (snapshot.distanceM && snapshot.durationMin ? snapshot.durationMin / (snapshot.distanceM / 1000) : null);
  return (
    <section aria-label="Health snapshot">
      <p className="mb-1 flex items-center justify-between font-label text-[11px] uppercase tracking-wide text-wood-dark/80">
        <span>
          What this walk did
          {snapshot.durationMin ? ` · ${snapshot.durationMin} min` : ""}
          {p ? ` · ${pace(p)}` : ""}
        </span>
        {snapshot.isDemo && <DemoChip />}
      </p>
      <HealthStats snapshot={snapshot} />

      {context && context.goalImpact.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t-2 border-wood-dark/30 pt-2" aria-label="Today's goals">
          {context.goalImpact.map((g) => (
            <li key={g.type}>
              <p className="flex justify-between text-xs text-wood-dark">
                <span>
                  +{g.amount.toLocaleString()} {g.unit} · {Math.round(g.pctOfTarget * 100)}% of your daily goal
                </span>
                <span className="font-heading">{g.done ? "Goal met ✓" : `${Math.round(g.todayPct * 100)}% today`}</span>
              </p>
              <EnergyBar pct={g.todayPct} color={GOAL_COLOR[g.type]} segments={16} label={`${g.label}: ${Math.round(g.todayPct * 100)}% of today's goal`} />
            </li>
          ))}
        </ul>
      )}

      {context?.placeInsight ? (
        <div className="mt-2 flex items-end gap-2 border-t-2 border-wood-dark/30 pt-2">
          <p className="flex-1 text-sm text-wood-dark">{context.placeInsight.text}</p>
          <Sparkline
            values={context.placeInsight.history.map((h) => h.hr)}
            muted={new Set(context.placeInsight.history.flatMap((h, i) => (h.comparable ? [] : [i])))}
            width={90}
            height={30}
            label={`Heart rate on ${context.placeInsight.visits} visits here`}
          />
        </div>
      ) : (
        context?.usual && <p className="mt-2 border-t-2 border-wood-dark/30 pt-2 text-sm text-wood-dark">{context.usual.text}</p>
      )}
    </section>
  );
}
