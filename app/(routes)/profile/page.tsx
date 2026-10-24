import type { Metadata } from "next";
import Link from "next/link";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { NotMedicalAdvice } from "@/components/health/HealthBits";
import { WeeklySummaryCard } from "@/components/health/WeeklySummaryCard";
import { InsightsCard } from "@/components/health/InsightsCard";
import { HealthStoryCard, RecoveryCard, TrendsCard } from "@/components/health/StoryCards";
import { CdcBaselineCard } from "@/components/health/CdcBaselineCard";
import { HealthSources } from "@/components/health/HealthSources";
import { DeleteAccount } from "@/components/ui/DeleteAccount";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getStore } from "@/lib/db";
import { getBadges, getCdcBaseline, getConnectionsView, getHealthStory, getViewer } from "@/lib/app/views";

export const metadata: Metadata = { title: "Profile · CityDex" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  strava_keys: "Strava isn't set up yet: add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.",
  strava_denied: "Strava connection was cancelled.",
  strava_state: "Strava connection expired. Please try again.",
  strava_scope: "CityDex needs activity read access to use Strava.",
  strava_exchange: "Couldn't finish connecting Strava.",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const { error, connected } = await searchParams;
  const [viewer, health, badges, sources] = await Promise.all([
    getViewer(),
    getHealthStory(DEMO_USER_ID),
    getBadges(DEMO_USER_ID),
    getConnectionsView(DEMO_USER_ID),
  ]);
  const { story, trends, weekly, insights, effects, stepGoal } = health;
  const earned = badges.filter((b) => b.earnedAt);
  const totalPoints = (await getStore().getStampsByUser(DEMO_USER_ID)).reduce((s, x) => s + x.points, 0);

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 px-4 py-4">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center border-4 border-wood-dark bg-wood-light text-3xl">
          {viewer.avatarEmoji}
        </span>
        <div>
          <h1 className="font-heading text-2xl text-wood-dark">@{viewer.username}</h1>
          <p className="text-sm text-wood-dark/80">
            {totalPoints.toLocaleString()} pts · {earned.length} badges · invite code{" "}
            <span className="font-label">{viewer.inviteCode}</span>
          </p>
        </div>
      </header>

      {(error || connected) && (
        <p role="status" className="border-4 border-wood-dark bg-parchment p-2 text-sm text-wood-dark">
          {error ? ERRORS[error] ?? "Something went wrong." : `Connected ${connected}.`}
        </p>
      )}

      <HealthStoryCard story={story} />
      {trends.recovery && <RecoveryCard recovery={trends.recovery} />}
      <TrendsCard trends={trends} />
      <InsightsCard insights={insights} effects={effects} />
      <WeeklySummaryCard summary={weekly} stepGoal={stepGoal} />
      <CdcBaselineCard data={getCdcBaseline()} weekCardioMinutes={weekly.totals.zoneMinutes} />
      <HealthSources sources={sources} />

      <PixelPanel>
        <h2 className="font-heading text-xl text-wood-dark">Badges</h2>
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <li
              key={b.slug}
              className={`border-2 border-wood-dark p-1.5 text-center ${b.earnedAt ? "bg-parchment" : "bg-wood-dark/10 opacity-60"}`}
              title={b.description}
            >
              <span aria-hidden="true" className="block text-2xl">{b.earnedAt ? b.icon : "🔒"}</span>
              <span className="block font-label text-[10px] uppercase leading-tight text-wood-dark">{b.name}</span>
              {b.health && <span className="block text-[10px] text-berry">health</span>}
            </li>
          ))}
        </ul>
      </PixelPanel>

      <PixelPanel>
        <h2 className="font-heading text-xl text-wood-dark">Privacy</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-wood-dark/90">
          <li>Leaderboards never show your location or routes.</li>
          <li>Check-in spots are rounded to about 10 m. Walk paths stay on your device.</li>
          <li>Photo location data (EXIF) is removed before upload.</li>
          <li>Health tokens are encrypted and only the server can read them.</li>
        </ul>
        <p className="mt-2 text-sm text-wood-dark">
          Consent: {viewer.consentedAt ? `given ${new Date(viewer.consentedAt).toLocaleDateString()}` : "not given yet"} ·{" "}
          <Link href="/onboarding" className="underline">review</Link>
        </p>
        <DeleteAccount />
      </PixelPanel>

      <NotMedicalAdvice />
    </div>
  );
}
