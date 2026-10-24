import type { WeeklySummary } from "@/lib/health/summary";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DemoChip, SourceTag } from "./HealthBits";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export function WeeklySummaryCard({ summary, stepGoal }: { summary: WeeklySummary; stepGoal: number }) {
  const max = Math.max(stepGoal, ...summary.days.map((d) => d.values.steps ?? 0), 1);
  const src = (f: keyof WeeklySummary["sources"]) => summary.sources[f]?.[0];
  return (
    <PixelPanel>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl text-wood-dark">This week&apos;s health</h2>
        {summary.isDemo && <DemoChip />}
      </div>

      <div className="mt-3 flex h-24 items-end gap-1.5" role="img" aria-label="Steps per day this week">
        {summary.days.map((d, i) => {
          const v = d.values.steps ?? 0;
          const hit = v >= stepGoal;
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-0.5">
              <div className="relative w-full flex-1">
                <div
                  className="absolute bottom-0 w-full border-2 border-wood-dark"
                  style={{ height: `${(v / max) * 100}%`, background: hit ? "#6daa2c" : "#a0703c" }}
                  title={`${d.date}: ${v.toLocaleString()} steps`}
                />
              </div>
              <span className="font-label text-[10px] text-wood-dark/80">{DOW[i]}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-wood-dark/75">Green bars hit your {stepGoal.toLocaleString()}-step goal.</p>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t-4 border-wood-dark pt-3">
        <div>
          <dt className="font-label text-[11px] uppercase text-wood-dark/75">Steps<SourceTag source={src("steps")} /></dt>
          <dd className="font-heading text-xl text-activity">{summary.totals.steps.toLocaleString()}</dd>
          <dd className="text-xs text-wood-dark/75">{summary.averages.stepsPerDay.toLocaleString()} / day</dd>
        </div>
        <div>
          <dt className="font-label text-[11px] uppercase text-wood-dark/75">Active kcal<SourceTag source={src("activeKcal")} /></dt>
          <dd className="font-heading text-xl text-activity">{summary.totals.activeKcal.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-label text-[11px] uppercase text-wood-dark/75">Cardio min (Z2+)<SourceTag source={src("zoneMinutes")} /></dt>
          <dd className="font-heading text-xl text-activity">{summary.totals.zoneMinutes}</dd>
          <dd className="text-xs text-wood-dark/75">{summary.activeDays} active days</dd>
        </div>
        <div>
          <dt className="font-label text-[11px] uppercase text-wood-dark/75">Resting HR<SourceTag source={src("restingHr")} /></dt>
          <dd className="font-heading text-xl text-activity">{summary.averages.restingHr ?? "–"}<span className="text-sm text-wood-dark"> bpm</span></dd>
        </div>
        <div>
          <dt className="font-label text-[11px] uppercase text-wood-dark/75">SpO₂ avg<SourceTag source={src("spo2Avg")} /></dt>
          <dd className="font-heading text-xl text-activity">{summary.averages.spo2Avg ?? "–"}<span className="text-sm text-wood-dark">%</span></dd>
        </div>
        <div>
          <dt className="font-label text-[11px] uppercase text-wood-dark/75">Sleep avg<SourceTag source={src("sleepHours")} /></dt>
          <dd className="font-heading text-xl text-activity">{summary.averages.sleepHours ?? "–"}<span className="text-sm text-wood-dark"> h</span></dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-wood-dark/75">
        {summary.stamps} check-ins this week, with {summary.checkinZoneMinutes} cardio minutes on the way to them.
      </p>
    </PixelPanel>
  );
}
