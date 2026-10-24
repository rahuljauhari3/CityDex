"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelPanel } from "@/components/ui/PixelPanel";
import type { GoalType } from "@/lib/db/types";

const GOALS: { type: GoalType; label: string; unit: string; icon: string; hint: string }[] = [
  { type: "steps", label: "Daily steps", unit: "steps / day", icon: "🥾", hint: "8,000 is a common starting point." },
  { type: "active_kcal", label: "Active calories", unit: "kcal / day", icon: "🔥", hint: "Energy burned moving, beyond resting." },
  { type: "zone_minutes", label: "Cardio minutes (HR zone 2+)", unit: "min / day", icon: "❤️", hint: "About 150 min/week matches the CDC adult guideline." },
  { type: "explore", label: "Explore new places", unit: "places / week", icon: "🧭", hint: "Variety keeps walks interesting." },
  { type: "recovery", label: "Stress & recovery", unit: "green/quiet visits / week", icon: "🌿", hint: "Parks, water and nature spots." },
];

type GoalState = Record<GoalType, { active: boolean; target: number }>;

export function OnboardingFlow({
  initial,
  initialAge,
  demoConnected,
  hasStrava,
  stravaConnected,
}: {
  initial: GoalState;
  initialAge: number | null;
  demoConnected: boolean;
  hasStrava: boolean;
  stravaConnected: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<GoalState>(initial);
  const [age, setAge] = useState<string>(initialAge ? String(initialAge) : "");
  const [connectDemo, setConnectDemo] = useState(demoConnected);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goals: GOALS.map((g) => ({ type: g.type, target: goals[g.type].target, active: goals[g.type].active })),
        age: age ? Number(age) : null,
        consent,
        connectDemo,
      }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
      return;
    }
    router.push("/quests");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ol className="flex gap-1" aria-label="Steps">
        {["Goals", "Sources", "Consent"].map((label, i) => (
          <li key={label} className={`flex-1 border-2 border-wood-dark py-1 text-center font-label text-[11px] uppercase ${i === step ? "bg-activity text-parchment" : "bg-parchment text-wood-dark"}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <PixelPanel>
          <h2 className="font-heading text-xl text-wood-dark">Pick your goals</h2>
          <ul className="mt-2 space-y-3">
            {GOALS.map((g) => (
              <li key={g.type} className="border-t-2 border-wood-dark/30 pt-2">
                <label className="flex items-center gap-2 text-base text-wood-dark">
                  <input
                    type="checkbox"
                    checked={goals[g.type].active}
                    onChange={(e) => setGoals({ ...goals, [g.type]: { ...goals[g.type], active: e.target.checked } })}
                    className="h-5 w-5 accent-activity"
                  />
                  <span aria-hidden="true">{g.icon}</span> {g.label}
                </label>
                {goals[g.type].active && (
                  <label className="mt-1 flex items-center gap-2 pl-7 text-sm text-wood-dark">
                    <input
                      type="number"
                      min={1}
                      value={goals[g.type].target}
                      onChange={(e) => setGoals({ ...goals, [g.type]: { ...goals[g.type], target: Number(e.target.value) || 1 } })}
                      className="w-24 border-2 border-wood-dark bg-parchment px-2 py-1 text-base"
                    />
                    {g.unit}
                  </label>
                )}
                <p className="pl-7 text-xs text-wood-dark/70">{g.hint}</p>
              </li>
            ))}
          </ul>
          <label className="mt-3 block border-t-2 border-wood-dark/30 pt-2 text-sm text-wood-dark">
            Age (optional, for heart-rate zones: max HR ≈ 220 − age)
            <input
              type="number"
              min={13}
              max={110}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 block w-24 border-2 border-wood-dark bg-parchment px-2 py-1 text-base"
            />
          </label>
        </PixelPanel>
      )}

      {step === 1 && (
        <PixelPanel>
          <h2 className="font-heading text-xl text-wood-dark">Connect health sources</h2>
          <label className="mt-2 flex items-start gap-2 text-base text-wood-dark">
            <input type="checkbox" checked={connectDemo} onChange={(e) => setConnectDemo(e.target.checked)} className="mt-1 h-5 w-5 accent-activity" />
            <span>
              Use the demo watch (synthetic steps, heart rate, calories and SpO₂, labeled DEMO)
            </span>
          </label>
          <ul className="mt-3 space-y-1 text-sm text-wood-dark/90">
            <li className="flex items-center justify-between gap-2">
              <span>• <strong>Strava</strong>: distance, heart rate and calories from your activities.</span>
              {stravaConnected ? (
                <span className="font-label text-[10px] uppercase text-grass">● connected</span>
              ) : hasStrava ? (
                <a href="/api/health/strava/connect" className="shrink-0 border-2 border-wood-dark bg-activity px-2 py-0.5 font-label text-[10px] uppercase text-parchment">
                  Connect
                </a>
              ) : (
                <span className="shrink-0 font-label text-[10px] uppercase text-wood-dark/70">Needs keys</span>
              )}
            </li>
            <li>• <strong>Apple Health</strong>: no web API, so upload your export.xml on your Profile.</li>
            <li>• <strong>WHOOP / Fitbit</strong>: OAuth, planned.</li>
            <li>• <strong>Garmin / Samsung</strong>: coming soon (business approval / Android-only SDK).</li>
          </ul>
        </PixelPanel>
      )}

      {step === 2 && (
        <PixelPanel>
          <h2 className="font-heading text-xl text-wood-dark">What CityDex stores</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-wood-dark">
            <li><strong>Check-in location</strong>, rounded to about 10 m. Your walk path stays on your device.</li>
            <li><strong>A health snapshot</strong> for each check-in: steps, heart rate and zones, active calories, SpO₂ when available, and which source each came from.</li>
            <li><strong>Your photo</strong>, exactly as you took it, with location data stripped. Don&apos;t photograph people.</li>
            <li>Friends see your stamps and health snapshots in the feed. <strong>Leaderboards never show location.</strong></li>
            <li>You can disconnect sources or delete everything from your Profile at any time.</li>
          </ul>
          <p className="mt-2 text-sm text-wood-dark/80">CityDex gives wellness insights only. It is not a medical device or medical advice.</p>
          <label className="mt-3 flex items-start gap-2 text-base text-wood-dark">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 accent-activity" />
            I understand and agree to CityDex storing this data.
          </label>
        </PixelPanel>
      )}

      {error && <p role="alert" className="text-sm text-berry">{error}</p>}

      <div className="flex gap-2">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="flex-1 border-4 border-wood-dark bg-parchment py-2 font-heading text-wood-dark">
            Back
          </button>
        ) : (
          <Link href="/map" className="flex-1 border-4 border-wood-dark bg-parchment py-2 text-center font-heading text-wood-dark">
            Later
          </Link>
        )}
        {step < 2 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="flex-1 border-4 border-wood-dark bg-activity py-2 font-heading text-parchment">
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={!consent}
            onClick={finish}
            className="flex-1 border-4 border-wood-dark bg-activity py-2 font-heading text-parchment disabled:bg-wood-light disabled:text-wood-dark"
          >
            Start exploring
          </button>
        )}
      </div>
    </div>
  );
}
