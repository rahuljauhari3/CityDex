import type { Challenge, MemberWeek } from "@/lib/social/challenges";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DemoChip, EnergyBar } from "@/components/health/HealthBits";

/** "This week with friends": circle stats + weekly challenges. */
export function SocialHealthStrip({ members, challenges, isDemo }: { members: MemberWeek[]; challenges: Challenge[]; isDemo: boolean }) {
  if (members.length <= 1) {
    return (
      <PixelPanel>
        <h2 className="font-heading text-xl text-wood-dark">This week with friends</h2>
        <p className="mt-1 text-sm text-wood-dark/80">Add friends to start weekly health challenges together.</p>
      </PixelPanel>
    );
  }
  const total = members.reduce((s, m) => s + m.steps, 0);
  const cardio = members.reduce((s, m) => s + m.cardioMinutes, 0);
  return (
    <PixelPanel>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl text-wood-dark">This week with friends</h2>
        {isDemo && <DemoChip />}
      </div>
      <p className="text-sm text-wood-dark/80">
        Your circle of {members.length}: <strong className="font-heading text-activity">{Math.round(total / 1000)}K</strong> steps and{" "}
        <strong className="font-heading text-activity">{cardio}</strong> cardio minutes so far.
      </p>

      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Friends this week">
        {members.map((m) => (
          <li key={m.userId} className={`min-w-[5.5rem] border-2 border-wood-dark p-1.5 text-center ${m.isViewer ? "bg-[#fff3d6]" : "bg-parchment"}`}>
            <span aria-hidden="true" className="block text-xl">{m.avatarEmoji}</span>
            <span className="block truncate text-xs text-wood-dark">{m.isViewer ? "you" : `@${m.username}`}</span>
            <span className="block font-heading text-sm text-activity">{m.cardioMinutes} min</span>
            <span className="block font-label text-[9px] uppercase text-wood-dark/75">{m.activeDays} active days</span>
          </li>
        ))}
      </ul>

      <ul className="mt-3 space-y-3">
        {challenges.map((c) => (
          <li key={c.id} className="border-t-2 border-wood-dark/30 pt-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-heading text-base text-wood-dark">
                <span aria-hidden="true">{c.icon}</span> {c.title}
              </p>
              <p className="font-heading text-sm text-wood-dark">
                {c.mode === "group" ? `${Math.round(c.pct * 100)}%` : `${c.progress}/${c.goal} done`}
              </p>
            </div>
            <p className="text-xs text-wood-dark/80">{c.description}</p>
            <EnergyBar pct={c.pct} color={c.id === "each-green" ? "#4caf50" : c.id === "each-cardio" ? "#c0392b" : "#6daa2c"} segments={20} label={`${c.title}: ${Math.round(c.pct * 100)}%`} />
            {c.mode === "each" && (
              <p className="mt-1 text-xs text-wood-dark/80">
                {c.rows.map((r, i) => (
                  <span key={r.userId}>
                    {i > 0 && " · "}
                    <span className={r.done ? "font-heading text-grass" : ""}>
                      {r.isViewer ? "you" : r.username} {r.value}
                      {r.done ? " ✓" : ""}
                    </span>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-wood-dark/70">Built from health data you already share with friends. No locations.</p>
    </PixelPanel>
  );
}
