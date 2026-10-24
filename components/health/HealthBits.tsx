import type { HealthSnapshot, ProviderId } from "@/lib/db/types";
import type { ReactNode } from "react";

/** Short label for where a value came from (PLAN §11: label DEMO and est.). */
export const SOURCE_LABEL: Record<ProviderId | "est" | "stamps", string> = {
  demo: "DEMO",
  strava: "Strava",
  apple_export: "Apple",
  whoop: "WHOOP",
  fitbit: "Fitbit",
  garmin: "Garmin",
  samsung: "Samsung",
  est: "est.",
  stamps: "stamps",
};

export function SourceTag({ source }: { source: ProviderId | "est" | "stamps" | null | undefined }) {
  if (!source) return null;
  const demo = source === "demo";
  return (
    <span
      className={`ml-1 inline-block border-2 px-1 align-middle font-label text-[10px] uppercase leading-tight ${
        demo ? "border-wood-dark bg-wood-light text-wood-dark" : "border-wood-dark/60 bg-parchment text-wood-dark"
      }`}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function DemoChip({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block border-2 border-wood-dark bg-wood-light px-1.5 font-label text-[11px] uppercase text-wood-dark ${className}`}
      title="Demo data: synthetic numbers, not from a real device"
    >
      Demo
    </span>
  );
}

export function NotMedicalAdvice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-wood-dark/75 ${className}`}>
      Wellness insight only, not medical advice. Talk to a clinician about health decisions.
    </p>
  );
}

const ZONE_COLORS = ["#9e9e9e", "#6daa2c", "#f0b429", "#fc5200", "#c0392b"];

/** Stacked bar of minutes per heart-rate zone. */
export function ZoneBar({ zones }: { zones: NonNullable<HealthSnapshot["hrZoneMinutes"]> }) {
  const values = [zones.z1, zones.z2, zones.z3, zones.z4, zones.z5];
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden border-2 border-wood-dark" role="img"
        aria-label={`Heart-rate zones: ${values.map((v, i) => `zone ${i + 1} ${Math.round(v)} min`).join(", ")}`}>
        {values.map((v, i) =>
          v > 0 ? <div key={i} style={{ width: `${(v / total) * 100}%`, background: ZONE_COLORS[i] }} /> : null,
        )}
      </div>
      <div className="mt-1 flex justify-between font-label text-[10px] uppercase text-wood-dark/80">
        {values.map((v, i) => (
          <span key={i}>
            Z{i + 1} {Math.round(v)}m
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, source }: { label: string; value: ReactNode; unit?: string; source?: ProviderId | "est" }) {
  return (
    <div>
      <dt className="font-label text-[11px] uppercase tracking-wide text-wood-dark/75">
        {label}
        <SourceTag source={source} />
      </dt>
      <dd className="font-heading text-xl leading-tight text-activity">
        {value}
        {unit && <span className="ml-0.5 text-sm text-wood-dark">{unit}</span>}
      </dd>
    </div>
  );
}

/** The health snapshot grid used on cards, the reveal and the feed. */
export function HealthStats({ snapshot, compact = false }: { snapshot: HealthSnapshot; compact?: boolean }) {
  // Only tag individual fields when sources are mixed; a single-source
  // snapshot gets one label from the caller (e.g. one DEMO chip).
  const all = Object.values(snapshot.fieldSources ?? {});
  const mixed = new Set(all).size > 1 || (snapshot.stepsEstimated ?? false);
  const src = mixed ? snapshot.fieldSources ?? {} : {};
  const km = snapshot.distanceM !== undefined ? (snapshot.distanceM / 1000).toFixed(1) : null;
  return (
    <div>
      <dl className={`grid gap-x-3 gap-y-2 ${compact ? "grid-cols-4" : "grid-cols-3"}`}>
        {km && <Stat label="Distance" value={km} unit="km" source={src.distanceM} />}
        {snapshot.steps !== undefined && (
          <Stat label="Steps" value={snapshot.steps.toLocaleString()} source={snapshot.stepsEstimated ? "est" : src.steps} />
        )}
        {snapshot.hrAvg !== undefined && <Stat label="Avg HR" value={snapshot.hrAvg} unit="bpm" source={src.hrAvg} />}
        {!compact && snapshot.hrMax !== undefined && <Stat label="Max HR" value={snapshot.hrMax} unit="bpm" source={src.hrMax} />}
        {snapshot.activeKcal !== undefined && <Stat label="Active" value={snapshot.activeKcal} unit="kcal" source={src.activeKcal} />}
        {!compact && snapshot.spo2Avg !== undefined && <Stat label="SpO₂" value={snapshot.spo2Avg} unit="%" source={src.spo2Avg} />}
      </dl>
      {!compact && snapshot.hrZoneMinutes && (
        <div className="mt-3">
          <p className="mb-1 font-label text-[11px] uppercase tracking-wide text-wood-dark/75">Heart-rate zones</p>
          <ZoneBar zones={snapshot.hrZoneMinutes} />
        </div>
      )}
    </div>
  );
}

/** Pixel "energy bar" progress meter (ui.md: goal rings as pixel bars). */
export function EnergyBar({ pct, color = "#fc5200", segments = 10, label }: { pct: number; color?: string; segments?: number; label: string }) {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * segments);
  return (
    <div className="flex gap-[2px]" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className="h-3 flex-1 border border-wood-dark"
          style={{ background: i < filled ? color : "rgba(91,58,41,0.12)" }}
        />
      ))}
    </div>
  );
}
