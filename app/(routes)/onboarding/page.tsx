import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { getStore } from "@/lib/db";
import type { GoalType } from "@/lib/db/types";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { DEFAULT_GOALS } from "@/lib/health/summary";
import { getViewer } from "@/lib/app/views";
import { hasStrava } from "@/lib/config";

export const metadata: Metadata = { title: "Get started · CityDex" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const store = getStore();
  const [viewer, goals, conns] = await Promise.all([
    getViewer(),
    store.getGoals(DEMO_USER_ID),
    store.getConnections(DEMO_USER_ID),
  ]);
  const initial = Object.fromEntries(
    DEFAULT_GOALS.map((d) => {
      const g = goals.find((x) => x.type === d.type) ?? d;
      return [d.type, { active: g.active, target: g.target }];
    }),
  ) as Record<GoalType, { active: boolean; target: number }>;

  return (
    <div className="mx-auto max-w-screen-sm space-y-3 px-4 py-4">
      <header>
        <h1 className="font-heading text-3xl text-wood-dark">Welcome to CityDex</h1>
        <p className="text-sm text-wood-dark/80">
          How does this place affect your body? Set goals, connect your wearables, and collect the city.
        </p>
      </header>
      <OnboardingFlow
        initial={initial}
        initialAge={viewer.age}
        demoConnected={conns.some((c) => c.provider === "demo")}
        hasStrava={hasStrava}
        stravaConnected={conns.some((c) => c.provider === "strava")}
      />
    </div>
  );
}
