import type { PlaceInsight } from "@/lib/insights/place";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DemoChip } from "./HealthBits";

export function InsightsCard({ insights }: { insights: PlaceInsight[] }) {
  return (
    <PixelPanel>
      <h2 className="font-heading text-xl text-wood-dark">How places affect your body</h2>
      {insights.length === 0 ? (
        <p className="mt-2 text-sm text-wood-dark/80">
          Visit the same place twice at a similar pace and CityDex will compare your heart rate across visits.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {insights.slice(0, 3).map((i) => (
            <li key={i.placeId} className="border-l-4 pl-2" style={{ borderColor: i.deltaBpm <= -2 ? "#6daa2c" : i.deltaBpm >= 2 ? "#fc5200" : "#a0703c" }}>
              <p className="text-base text-wood-dark">
                {i.text} {i.isDemo && <DemoChip />}
              </p>
              <p className="text-xs text-wood-dark/75">
                {i.firstHr} → {i.latestHr} bpm · {i.bpmPerWeek > 0 ? "+" : ""}
                {i.bpmPerWeek} bpm/week · based on {i.comparableVisits} of {i.visits} visits
                {i.paceMinPerKm ? ` at ~${i.paceMinPerKm} min/km` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-wood-dark/70">
        A lower heart rate at the same pace often goes with better aerobic fitness, but sleep, heat, stress and caffeine
        also move it. Trends, not diagnoses.
      </p>
    </PixelPanel>
  );
}
