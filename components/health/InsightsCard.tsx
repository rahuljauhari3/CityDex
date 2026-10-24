import type { PlaceEffects, PlaceInsight } from "@/lib/insights/place";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DemoChip } from "./HealthBits";
import { Sparkline } from "./Sparkline";

const CATEGORY_ICON: Record<string, string> = {
  park: "🌳", nature: "🌿", water: "🌊", mural: "🎨", statue: "🗿", cafe: "☕", building: "🏛️",
  transit: "🚉", door: "🚪", shop: "🛍️", oddity: "✨", other: "📍",
};

export function InsightsCard({ insights, effects }: { insights: PlaceInsight[]; effects: PlaceEffects }) {
  return (
    <PixelPanel>
      <h2 className="font-heading text-xl text-wood-dark">How places affect your body</h2>

      {insights.length === 0 ? (
        <p className="mt-2 text-sm text-wood-dark/80">
          Visit the same place twice at a similar pace and CityDex will compare your heart rate across visits.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {insights.slice(0, 3).map((i) => {
            const muted = new Set(i.history.flatMap((h, idx) => (h.comparable ? [] : [idx])));
            const color = i.deltaBpm <= -2 ? "#2f7d32" : i.deltaBpm >= 2 ? "#fc5200" : "#a0703c";
            return (
              <li key={i.placeId} className="border-l-4 pl-2" style={{ borderColor: color }}>
                <p className="text-base text-wood-dark">
                  {i.text} {i.isDemo && <DemoChip />}
                </p>
                <div className="mt-1 flex items-end gap-3">
                  <Sparkline values={i.history.map((h) => h.hr)} muted={muted} color={color} width={140} height={36} label={`Average heart rate per visit at ${i.placeName}`} />
                  <p className="text-xs text-wood-dark/75">
                    {i.firstHr} → {i.latestHr} bpm
                    <br />
                    {i.bpmPerWeek > 0 ? "+" : ""}
                    {i.bpmPerWeek} bpm/week
                  </p>
                </div>
                <p className="text-xs text-wood-dark/75">
                  Based on {i.comparableVisits} of {i.visits} visits
                  {i.paceMinPerKm ? ` at ~${i.paceMinPerKm} min/km` : ""}
                  {muted.size > 0 ? ". Hollow dots were at a different pace and are left out." : "."}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {(effects.bestCardio || effects.calmest) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {effects.bestCardio && (
            <div className="border-2 border-wood-dark bg-parchment p-2">
              <p className="font-label text-[10px] uppercase text-wood-dark/75">Best cardio spot</p>
              <p className="font-heading text-sm leading-tight text-wood-dark">{effects.bestCardio.placeName}</p>
              <p className="text-xs text-activity">{effects.bestCardio.avgZone2} cardio min / visit</p>
            </div>
          )}
          {effects.calmest && (
            <div className="border-2 border-wood-dark bg-parchment p-2">
              <p className="font-label text-[10px] uppercase text-wood-dark/75">Calmest walk</p>
              <p className="font-heading text-sm leading-tight text-wood-dark">{effects.calmest.placeName}</p>
              <p className="text-xs text-grass">avg {effects.calmest.avgHr} bpm</p>
            </div>
          )}
        </div>
      )}

      {effects.places.length > 0 && (
        <table className="mt-3 w-full table-fixed text-left text-sm text-wood-dark">
          <caption className="sr-only">Your places by visits</caption>
          <thead>
            <tr className="font-label text-[10px] uppercase text-wood-dark/75">
              <th className="w-[58%] pb-1 font-normal">Place</th>
              <th className="pb-1 text-right font-normal">Visits</th>
              <th className="pb-1 text-right font-normal">Avg HR</th>
              <th className="pb-1 text-right font-normal">Z2+ min</th>
            </tr>
          </thead>
          <tbody>
            {effects.places.slice(0, 5).map((p) => (
              <tr key={p.placeId} className="border-t border-wood-dark/20">
                <td className="truncate py-1 pr-2">
                  <span aria-hidden="true">{CATEGORY_ICON[p.category] ?? "📍"}</span> {p.placeName}
                </td>
                <td className="py-1 text-right font-heading">{p.visits}</td>
                <td className="py-1 text-right font-heading">{p.avgHr}</td>
                <td className="py-1 text-right font-heading text-activity">{p.avgZone2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-2 text-xs text-wood-dark/70">
        A lower heart rate at the same pace often goes with better aerobic fitness, but sleep, heat, stress and caffeine
        also move it. Trends, not diagnoses.
      </p>
    </PixelPanel>
  );
}
