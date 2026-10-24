import type { Metadata } from "next";
import Link from "next/link";
import { MapScreen } from "@/components/map/MapScreen";
import { DemoChip } from "@/components/health/HealthBits";
import { GoalBars } from "@/components/health/GoalBars";
import { isDemoMode } from "@/lib/config";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getQuests, getViewer } from "@/lib/app/views";

export const metadata: Metadata = { title: "Map · CityDex" };
export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { place } = await searchParams;
  const [viewer, { quests, today }] = await Promise.all([getViewer(), getQuests(DEMO_USER_ID, null, 5)]);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date());

  const header = (
    <header className="z-[1100] border-b-4 border-wood-dark bg-wood-light px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <p className="font-heading text-lg leading-none text-parchment">
          CityDex <span className="font-label text-[11px] text-parchment/90">Day {today.dayNumber}</span>
        </p>
        <p className="flex items-center gap-1.5 font-label text-[11px] text-parchment">
          <span>☀ {time}</span>
          {isDemoMode && <DemoChip className="bg-parchment" />}
        </p>
      </div>
      <div className="mt-1.5 border-2 border-wood-dark bg-parchment px-2 py-1.5">
        <GoalBars progress={today.progress} compact />
      </div>
      {!viewer.onboardedAt && (
        <Link href="/onboarding" className="mt-1.5 block border-2 border-wood-dark bg-activity px-2 py-1 text-center font-heading text-sm text-parchment">
          Set your health goals →
        </Link>
      )}
    </header>
  );

  return (
    <MapScreen
      demoMode={isDemoMode}
      header={header}
      focusPlaceId={place ?? null}
      questIds={quests.map((q) => q.place.id)}
    />
  );
}
