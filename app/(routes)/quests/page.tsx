import type { Metadata } from "next";
import Link from "next/link";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { GoalBars } from "@/components/health/GoalBars";
import { DemoChip, NotMedicalAdvice } from "@/components/health/HealthBits";
import { RARITY_LABEL_HEX } from "@/components/map/rarity";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getQuests } from "@/lib/app/views";

export const metadata: Metadata = { title: "Quests · CityDex" };
export const dynamic = "force-dynamic";

export default async function QuestsPage() {
  const { quests, today, recovery, usedDefaultPosition } = await getQuests(DEMO_USER_ID, null, 5);

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 px-4 py-4">
      <header>
        <h1 className="font-heading text-3xl text-wood-dark">Today&apos;s Quests</h1>
        <p className="text-sm text-wood-dark/80">Places picked to help you hit today&apos;s health goals.</p>
      </header>

      {recovery && (
        <Link href="/profile" className="block border-4 border-wood-dark px-3 py-2 pixel-shadow" style={{ background: recovery.level === "easy" ? "#fde3d3" : recovery.level === "moderate" ? "#fdf0c9" : "#e4f2d4" }}>
          <p className="font-label text-[11px] uppercase text-wood-dark/75">Recovery estimate {recovery.score}/100{recovery.isDemo ? " · DEMO" : ""}</p>
          <p className="font-heading text-base text-wood-dark">{recovery.headline}</p>
          {recovery.level === "easy" && <p className="text-sm text-wood-dark/80">Quests below favor short walks to green, quiet places today.</p>}
        </Link>
      )}

      <PixelPanel>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-heading text-xl text-wood-dark">Your goals today</h2>
          {today.isDemo && <DemoChip />}
        </div>
        <GoalBars progress={today.progress} />
        <Link href="/onboarding" className="mt-3 inline-block font-label text-xs uppercase text-wood-dark underline">
          Edit goals
        </Link>
      </PixelPanel>

      <ol className="space-y-3">
        {quests.map((q, i) => (
          <li key={q.place.id}>
            <Link href={`/map?place=${q.place.id}`} className="block">
              <PixelPanel className="transition-transform active:translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-label text-[11px] uppercase text-wood-dark/70">
                      Quest {i + 1} · {(q.distanceM / 1000).toFixed(1)} km ·{" "}
                      <span style={{ color: RARITY_LABEL_HEX[q.place.baselineRarity] }}>{q.place.baselineRarity}</span>
                    </p>
                    <h3 className="font-heading text-xl leading-tight text-wood-dark">{q.place.name}</h3>
                  </div>
                  <span aria-hidden="true" className="font-heading text-2xl text-activity">→</span>
                </div>
                <p className="mt-1 font-heading text-base text-activity">{q.reason}</p>
                {q.reasons.slice(1).map((r) => (
                  <p key={r} className="text-sm text-wood-dark/80">{r}</p>
                ))}
                <p className="mt-1 text-xs text-wood-dark/75">
                  Expect about {q.expected.steps.toLocaleString()} steps · {q.expected.activeKcal} kcal ·{" "}
                  {q.expected.zoneMinutes} cardio min{q.expected.estimated ? " (est.)" : " (from others' check-ins)"}
                </p>
              </PixelPanel>
            </Link>
          </li>
        ))}
      </ol>

      {usedDefaultPosition && (
        <p className="text-center text-xs text-wood-dark/70">Distances are measured from downtown Boston.</p>
      )}
      <NotMedicalAdvice />
    </div>
  );
}
