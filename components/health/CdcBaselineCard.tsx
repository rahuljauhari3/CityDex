import { PixelPanel } from "@/components/ui/PixelPanel";

interface Measure {
  id: string;
  measure: string;
  short: string;
  value: number;
  low: number;
  high: number;
  year: number;
}

interface CdcData {
  county: string;
  release: string;
  sourceUrl: string;
  measures: Measure[];
}

const SHOW = ["LPA", "SLEEP", "OBESITY", "BPHIGH", "MHLTH", "LONELINESS"];

/**
 * County baseline from CDC PLACES (REQ-17): puts your week next to what
 * adults in Suffolk County report. Population estimates, not about you.
 */
export function CdcBaselineCard({ data, weekCardioMinutes }: { data: CdcData; weekCardioMinutes: number }) {
  const lpa = data.measures.find((m) => m.id === "LPA");
  const rows = SHOW.map((id) => data.measures.find((m) => m.id === id)).filter((m): m is Measure => Boolean(m));
  // CDC adult guideline: at least 150 minutes of moderate activity a week.
  const guideline = 150;
  return (
    <PixelPanel>
      <h2 className="font-heading text-xl text-wood-dark">{data.county} baseline</h2>
      {lpa && (
        <p className="mt-2 text-base text-wood-dark">
          In {data.county}, <strong className="font-heading text-activity">{lpa.value}%</strong> of adults report no
          leisure-time physical activity. This week you logged{" "}
          <strong className="font-heading text-activity">{weekCardioMinutes}</strong> cardio minutes
          {weekCardioMinutes >= guideline
            ? `, past the ${guideline}-minute weekly guideline.`
            : ` of the ${guideline}-minute weekly guideline.`}
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {rows.map((m) => (
          <li key={m.id}>
            <div className="flex justify-between text-sm text-wood-dark">
              <span>{m.short}</span>
              <span className="font-heading">{m.value}%</span>
            </div>
            <div className="h-2 border border-wood-dark bg-wood-dark/10">
              <div className="h-full bg-wood-light" style={{ width: `${m.value}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-wood-dark/70">
        Source: CDC PLACES, County Data ({data.release} release), crude prevalence among adults, survey years{" "}
        {Math.min(...rows.map((r) => r.year))}–{Math.max(...rows.map((r) => r.year))}. Population estimates, not a
        statement about you.
      </p>
    </PixelPanel>
  );
}
