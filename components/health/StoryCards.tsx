import Link from "next/link";
import type { Takeaway, Tone } from "@/lib/health/story";
import type { HealthTrends, MetricTrend, RecoveryEstimate } from "@/lib/health/trends";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DemoChip, EnergyBar, SourceTag } from "./HealthBits";
import { Sparkline } from "./Sparkline";

const TONE_COLOR: Record<Tone, string> = { good: "#6daa2c", watch: "#fc5200", neutral: "#a0703c" };
const TONE_LABEL: Record<Tone, string> = { good: "Going well", watch: "Worth watching", neutral: "Steady" };

/** The headline: 3–4 plain-language takeaways from the last two weeks. */
export function HealthStoryCard({ story, limit = 4 }: { story: Takeaway[]; limit?: number }) {
  const shown = story.slice(0, limit);
  const anyDemo = shown.some((t) => t.isDemo);
  return (
    <PixelPanel className="bg-[#fff6e3]">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl text-wood-dark">Your health story</h2>
        {anyDemo && <DemoChip />}
      </div>
      <p className="text-sm text-wood-dark/80">What your body did over the last two weeks, in plain words.</p>
      <ul className="mt-3 space-y-3">
        {shown.map((t) => (
          <li key={t.id} className="flex gap-2 border-l-4 pl-2" style={{ borderColor: TONE_COLOR[t.tone] }}>
            <span aria-hidden="true" className="text-xl leading-6">{t.icon}</span>
            <div>
              <p className="font-heading text-base leading-snug text-wood-dark">{t.title}</p>
              <p className="text-sm text-wood-dark/80">{t.detail}</p>
              <span className="sr-only">{TONE_LABEL[t.tone]}</span>
            </div>
          </li>
        ))}
      </ul>
    </PixelPanel>
  );
}

const LEVEL_COLOR = { ready: "#6daa2c", moderate: "#f0b429", easy: "#fc5200" } as const;

export function RecoveryCard({ recovery }: { recovery: RecoveryEstimate }) {
  return (
    <PixelPanel>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl text-wood-dark">Today&apos;s recovery</h2>
        {recovery.isDemo && <DemoChip />}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-heading text-4xl" style={{ color: LEVEL_COLOR[recovery.level] }}>
          {recovery.score}
        </span>
        <div className="flex-1">
          <p className="font-heading text-base leading-snug text-wood-dark">{recovery.headline}</p>
          <EnergyBar pct={recovery.score / 100} color={LEVEL_COLOR[recovery.level]} segments={20} label={`Recovery estimate ${recovery.score} of 100`} />
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm text-wood-dark">
        {recovery.factors.map((f) => (
          <li key={f.label} className="flex justify-between gap-2">
            <span>{f.label}</span>
            <span className="font-heading" style={{ color: f.effect < 0 ? "#c0392b" : f.effect > 0 ? "#2f7d32" : "#5b3a29" }}>
              {f.effect > 0 ? "+" : ""}
              {f.effect}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-wood-dark/70">
        Starts at 80 and moves with each factor above. An estimate to plan your walk, not a medical score.
      </p>
      {recovery.level === "easy" && (
        <Link href="/quests" className="mt-2 block border-2 border-wood-dark bg-grass px-2 py-1 text-center font-heading text-sm text-wood-dark">
          See easy recovery quests →
        </Link>
      )}
    </PixelPanel>
  );
}

interface RowSpec {
  trend: MetricTrend;
  label: string;
  unit: string;
  color: string;
  /** Is a decrease good (resting HR) or bad (steps, sleep, cardio)? */
  lowerIsBetter: boolean;
  format?: (n: number) => string;
}

function TrendRow({ trend, label, unit, color, lowerIsBetter, format = (n) => String(n) }: RowSpec) {
  if (trend.current7 === null) return null;
  const d = trend.delta;
  const better = d === null || d === 0 ? null : lowerIsBetter ? d < 0 : d > 0;
  return (
    <li className="flex items-center gap-2 border-t-2 border-wood-dark/20 py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-label text-[11px] uppercase text-wood-dark/75">
          {label}
          <SourceTag source={trend.source} />
        </p>
        <p className="font-heading text-xl leading-tight text-wood-dark">
          {format(trend.current7)}
          <span className="text-sm"> {unit}</span>
        </p>
        {d !== null && (
          <p className="text-xs" style={{ color: better === null ? "#5b3a29" : better ? "#2f7d32" : "#c0392b" }}>
            {d > 0 ? "▲" : d < 0 ? "▼" : "–"} {format(Math.abs(d))} vs last week
          </p>
        )}
      </div>
      <Sparkline values={trend.series} color={color} label={`${label}, last ${trend.series.length} days`} />
    </li>
  );
}

export function TrendsCard({ trends }: { trends: HealthTrends }) {
  const k = (n: number) => Math.round(n).toLocaleString();
  return (
    <PixelPanel>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl text-wood-dark">4-week trends</h2>
        {trends.isDemo && <DemoChip />}
      </div>
      <p className="text-sm text-wood-dark/80">This week&apos;s daily average, compared with last week.</p>
      <ul className="mt-1">
        <TrendRow trend={trends.restingHr} label="Resting HR" unit="bpm" color="#c0392b" lowerIsBetter />
        <TrendRow trend={trends.sleep} label="Sleep" unit="h" color="#2196f3" lowerIsBetter={false} />
        <TrendRow trend={trends.steps} label="Steps" unit="/ day" color="#6daa2c" lowerIsBetter={false} format={k} />
        <TrendRow trend={trends.cardio} label="Cardio (Z2+)" unit="min / day" color="#fc5200" lowerIsBetter={false} format={k} />
      </ul>
      {trends.restingHr.perWeek !== null && (
        <p className="mt-1 text-xs text-wood-dark/75">
          Resting HR trend over {trends.restingHr.samples} days: {trends.restingHr.perWeek > 0 ? "+" : ""}
          {trends.restingHr.perWeek} bpm/week.
        </p>
      )}
    </PixelPanel>
  );
}
