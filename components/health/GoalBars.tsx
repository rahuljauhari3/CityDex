import type { GoalProgress } from "@/lib/health/summary";
import { GOAL_META } from "@/lib/health/summary";
import { EnergyBar, SourceTag } from "./HealthBits";

const COLORS: Record<string, string> = {
  steps: "#6daa2c",
  active_kcal: "#fc5200",
  zone_minutes: "#c0392b",
  explore: "#2196f3",
  recovery: "#4caf50",
};

/** Goal progress as pixel energy bars. `compact` is the map-header variant. */
export function GoalBars({ progress, compact = false }: { progress: GoalProgress[]; compact?: boolean }) {
  const shown = compact ? progress.filter((p) => p.goal.period === "day").slice(0, 3) : progress;
  return (
    <ul className={compact ? "space-y-1" : "space-y-3"}>
      {shown.map((p) => {
        const meta = GOAL_META[p.goal.type];
        return (
          <li key={p.goal.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`${compact ? "text-xs" : "text-sm"} text-wood-dark`}>
                <span aria-hidden="true">{meta.icon}</span> {compact ? meta.label.replace(" (zone 2+)", "") : meta.label}
                {!compact && <SourceTag source={p.source} />}
              </span>
              <span className={`font-heading ${compact ? "text-xs" : "text-sm"} text-wood-dark`}>
                {p.current.toLocaleString()}/{p.goal.target.toLocaleString()}
                {!compact && ` ${meta.unit}`}
              </span>
            </div>
            <EnergyBar pct={p.pct} color={COLORS[p.goal.type]} label={`${meta.label}: ${Math.round(p.pct * 100)}%`} segments={compact ? 12 : 16} />
          </li>
        );
      })}
    </ul>
  );
}
