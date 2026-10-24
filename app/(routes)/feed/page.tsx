import type { Metadata } from "next";
import Link from "next/link";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DemoChip, HealthStats, NotMedicalAdvice } from "@/components/health/HealthBits";
import { KudosButton } from "@/components/feed/KudosButton";
import { FriendsPanel } from "@/components/feed/FriendsPanel";
import { RARITY_LABEL_HEX, rarityHex } from "@/components/map/rarity";
import { DEMO_USER_ID } from "@/lib/demo-user";
import type { LeaderboardMetric, LeaderboardScope, LeaderboardWindow } from "@/lib/db/types";
import { getFeed, getFriendsView, getLeaderboard, getViewer } from "@/lib/app/views";

export const metadata: Metadata = { title: "Feed · CityDex" };
export const dynamic = "force-dynamic";

function ago(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

type Search = { tab?: string; scope?: string; window?: string; metric?: string };

function pick<T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tab = sp.tab === "leaderboard" ? "leaderboard" : sp.tab === "friends" ? "friends" : "feed";
  const href = (patch: Search) => {
    const q = new URLSearchParams({ ...sp, ...patch } as Record<string, string>);
    return `/feed?${q}`;
  };

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 px-4 py-4">
      <nav className="flex gap-1" aria-label="Feed sections">
        {(["feed", "leaderboard", "friends"] as const).map((t) => (
          <Link
            key={t}
            href={href({ tab: t })}
            aria-current={tab === t ? "page" : undefined}
            className={`flex-1 border-4 border-wood-dark py-1.5 text-center font-heading text-sm capitalize ${tab === t ? "bg-wood-dark text-parchment" : "bg-parchment text-wood-dark"}`}
          >
            {t}
          </Link>
        ))}
      </nav>
      {tab === "feed" && <FeedList />}
      {tab === "leaderboard" && (
        <Leaderboard
          scope={pick(sp.scope, ["global", "friends"] as const, "friends")}
          window={pick(sp.window, ["week", "all_time"] as const, "week")}
          metric={pick(sp.metric, ["steps", "points", "stamps"] as const, "steps")}
          href={href}
        />
      )}
      {tab === "friends" && <Friends />}
      <NotMedicalAdvice />
    </div>
  );
}

async function FeedList() {
  const items = await getFeed(DEMO_USER_ID);
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.stampId}>
          <PixelPanel className="p-3">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center border-2 border-wood-dark bg-wood-light text-xl">
                {it.avatarEmoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-wood-dark">
                  <strong>@{it.username}</strong> collected <strong>{it.placeName}</strong>
                </p>
                <p className="font-label text-[10px] uppercase text-wood-dark/70">
                  {ago(it.createdAt)} ·{" "}
                  <span style={{ color: RARITY_LABEL_HEX[it.rarity] }}>{it.rarity}</span>
                  {it.neighborhood ? ` · ${it.neighborhood}` : ""}
                </p>
              </div>
              <div
                className="h-12 w-12 shrink-0 overflow-hidden border-4"
                style={{ borderColor: rarityHex(it.rarity), background: "rgba(91,58,41,0.1)" }}
              >
                {it.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.photoPath} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-full items-center justify-center font-heading text-wood-dark/50">★</span>
                )}
              </div>
            </div>
            {it.healthSnapshot && (
              <div className="mt-2 border-t-2 border-wood-dark/30 pt-2">
                <HealthStats snapshot={it.healthSnapshot} compact />
                {it.healthSnapshot.isDemo && <DemoChip className="mt-1" />}
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <KudosButton stampId={it.stampId} count={it.kudosCount} given={it.viewerGaveKudos} own={it.userId === DEMO_USER_ID} />
            </div>
          </PixelPanel>
        </li>
      ))}
    </ul>
  );
}

async function Leaderboard({
  scope,
  window,
  metric,
  href,
}: {
  scope: LeaderboardScope;
  window: LeaderboardWindow;
  metric: LeaderboardMetric;
  href: (p: Search) => string;
}) {
  const rows = await getLeaderboard(DEMO_USER_ID, scope, window, metric);
  const unit = metric === "steps" ? "steps" : metric === "points" ? "pts" : "stamps";
  return (
    <div className="border-4 border-wood-dark bg-wood-light p-3 pixel-shadow">
      <h1 className="text-center font-heading text-2xl text-parchment">Notice Board</h1>
      <div className="mt-2 space-y-1">
        <Seg href={href} k="scope" cur={scope} opts={[["friends", "Friends"], ["global", "Global"]]} />
        <Seg href={href} k="window" cur={window} opts={[["week", "This week"], ["all_time", "All time"]]} />
        <Seg href={href} k="metric" cur={metric} opts={[["steps", "Steps"], ["points", "Points"], ["stamps", "Stamps"]]} />
      </div>
      <ol className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.userId}
            className={`flex items-center gap-2 border-2 border-wood-dark px-2 py-1.5 ${r.isViewer ? "bg-[#fff3d6]" : "bg-parchment"}`}
            style={{ transform: `rotate(${((r.rank * 37) % 5) - 2}deg)` }}
          >
            <span className="w-6 font-heading text-lg text-wood-dark">{r.rank}</span>
            <span aria-hidden="true" className="text-xl">{r.avatarEmoji}</span>
            <span className="flex-1 truncate text-base text-wood-dark">@{r.username}</span>
            <span className="font-heading text-activity">
              {r.value.toLocaleString()} <span className="text-xs text-wood-dark">{unit}</span>
            </span>
            <span
              className="w-6 text-right font-label text-xs"
              aria-label={r.rankChange > 0 ? `up ${r.rankChange}` : r.rankChange < 0 ? `down ${-r.rankChange}` : "no change"}
              style={{ color: r.rankChange > 0 ? "#2f7d32" : r.rankChange < 0 ? "#c0392b" : "#5b3a29" }}
            >
              {r.rankChange > 0 ? `▲${r.rankChange}` : r.rankChange < 0 ? `▼${-r.rankChange}` : "–"}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-xs text-parchment">
        Weekly board resets Monday 00:00 Boston time. No locations, ever. Steps include DEMO data.
      </p>
    </div>
  );
}

async function Friends() {
  const [friends, viewer] = await Promise.all([getFriendsView(DEMO_USER_ID), getViewer()]);
  return <FriendsPanel friends={friends} inviteCode={viewer.inviteCode} />;
}

function Seg<T extends string>({
  k,
  opts,
  cur,
  href,
}: {
  k: keyof Search;
  opts: [T, string][];
  cur: T;
  href: (p: Search) => string;
}) {
  return (
    <div className="flex">
      {opts.map(([v, label]) => (
        <Link
          key={v}
          href={href({ [k]: v })}
          className={`flex-1 border-2 border-wood-dark py-1 text-center font-label text-[11px] uppercase ${cur === v ? "bg-activity text-parchment" : "bg-parchment text-wood-dark"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
