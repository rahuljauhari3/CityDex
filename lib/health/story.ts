/**
 * "Your health story": turns trends, the weekly summary and place insights
 * into a short, ranked list of plain-language takeaways for Profile. Pure.
 * Wellness wording only: observations and gentle suggestions, no diagnoses.
 */

import type { PlaceEffects, PlaceInsight } from "@/lib/insights/place";
import type { WeeklySummary } from "./summary";
import type { HealthTrends } from "./trends";

export type Tone = "good" | "neutral" | "watch";

export interface Takeaway {
  id: string;
  icon: string;
  title: string;
  detail: string;
  tone: Tone;
  isDemo: boolean;
}

export interface StoryInput {
  trends: HealthTrends;
  weekly: WeeklySummary;
  stepGoal: number;
  insights: PlaceInsight[];
  effects: PlaceEffects;
  /** CDC weekly guideline for moderate activity, minutes. */
  guidelineMinutes?: number;
}

const TONE_ORDER: Record<Tone, number> = { good: 0, watch: 1, neutral: 2 };

export function buildHealthStory(input: StoryInput): Takeaway[] {
  const { trends, weekly, stepGoal, insights, effects } = input;
  const guideline = input.guidelineMinutes ?? 150;
  const demo = trends.isDemo;
  const out: Takeaway[] = [];

  const rhr = trends.restingHr;
  if (rhr.delta !== null && rhr.current7 !== null) {
    const d = rhr.delta;
    if (d <= -1) {
      out.push({
        id: "rhr",
        icon: "💓",
        title: `Resting HR down ${Math.abs(d)} bpm vs last week`,
        detail: `${rhr.current7} bpm on average this week. A falling resting HR often goes with better aerobic fitness and recovery.`,
        tone: "good",
        isDemo: demo,
      });
    } else if (d >= 2) {
      out.push({
        id: "rhr",
        icon: "💓",
        title: `Resting HR up ${d} bpm vs last week`,
        detail: "Short sleep, stress, heat, illness or hard training can all raise it. An easier day may help.",
        tone: "watch",
        isDemo: demo,
      });
    } else {
      out.push({
        id: "rhr",
        icon: "💓",
        title: `Resting HR steady at ${rhr.current7} bpm`,
        detail: "Within a beat of last week.",
        tone: "neutral",
        isDemo: demo,
      });
    }
  }

  const place = insights[0];
  if (place && Math.abs(place.deltaBpm) >= 2) {
    out.push({
      id: "place",
      icon: "📍",
      title: place.text,
      detail: `Based on ${place.comparableVisits} visits at a similar pace.`,
      tone: place.deltaBpm < 0 ? "good" : "watch",
      isDemo: place.isDemo,
    });
  }

  const cardio = weekly.totals.zoneMinutes;
  out.push({
    id: "cardio",
    icon: "❤️",
    title: cardio >= guideline ? `${cardio} cardio minutes: past the weekly guideline` : `${cardio} of ${guideline} weekly cardio minutes`,
    detail:
      cardio >= guideline
        ? "The CDC suggests at least 150 minutes of moderate activity a week."
        : `About ${Math.ceil((guideline - cardio) / 10) * 10} more minutes of brisk walking gets you there.`,
    tone: cardio >= guideline ? "good" : "neutral",
    isDemo: weekly.isDemo,
  });

  const goalDays = weekly.days.filter((d) => (d.values.steps ?? 0) >= stepGoal).length;
  const tracked = weekly.days.filter((d) => d.values.steps !== undefined).length;
  if (tracked > 0) {
    out.push({
      id: "steps",
      icon: "🥾",
      title: `Step goal hit on ${goalDays} of ${tracked} days`,
      detail:
        trends.steps.delta !== null
          ? `${Math.round(trends.steps.current7 ?? 0).toLocaleString()} steps/day over the last 7 full days, ${trends.steps.delta >= 0 ? "up" : "down"} ${Math.abs(Math.round(trends.steps.delta)).toLocaleString()} from the week before.`
          : `Your goal is ${stepGoal.toLocaleString()} steps a day.`,
      tone: goalDays >= Math.ceil(tracked * 0.6) ? "good" : "neutral",
      isDemo: weekly.isDemo,
    });
  }

  const sleep = trends.sleep;
  if (sleep.current7 !== null) {
    out.push({
      id: "sleep",
      icon: "🌙",
      title: sleep.current7 < 7 ? `Averaging ${sleep.current7} h of sleep` : `Sleeping ${sleep.current7} h on average`,
      detail: sleep.current7 < 7 ? "Adults generally need 7+ hours. Short sleep can raise resting HR the next day." : "That's in the 7+ hour range adults generally need.",
      tone: sleep.current7 < 7 ? "watch" : "good",
      isDemo: demo,
    });
  }

  if (effects.bestCardio && effects.bestCardio.avgZone2 >= 10) {
    out.push({
      id: "best-cardio",
      icon: "🏃",
      title: `${effects.bestCardio.placeName} is your best cardio spot`,
      detail: `${effects.bestCardio.avgZone2} cardio minutes per visit on average over ${effects.bestCardio.visits} visit${effects.bestCardio.visits === 1 ? "" : "s"}.`,
      tone: "good",
      isDemo: effects.bestCardio.isDemo,
    });
  }

  const nd = trends.nextDay;
  if (nd && Math.abs(nd.diff) >= 1) {
    out.push({
      id: "next-day",
      icon: "🔁",
      title: `After active days, your resting HR is ${Math.abs(nd.diff)} bpm ${nd.diff < 0 ? "lower" : "higher"} the next morning`,
      detail: `${nd.activeAvg} vs ${nd.restAvg} bpm (${nd.activeDays} active vs ${nd.restDays} lighter days). A pattern, not proof of cause.`,
      tone: nd.diff < 0 ? "good" : "neutral",
      isDemo: demo,
    });
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
