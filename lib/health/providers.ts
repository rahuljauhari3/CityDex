/**
 * Health source catalog (PLAN.md §4). Honest about what a web app can reach:
 * Apple Health and Samsung Health have no web API, and Garmin needs business
 * approval.
 */

import type { ProviderId } from "@/lib/db/types";

export type ConnectKind = "builtin" | "oauth" | "upload" | "none";

export interface ProviderInfo {
  id: ProviderId;
  displayName: string;
  status: "available" | "needs_keys" | "coming_soon";
  connect: ConnectKind;
  fields: string[];
  note: string;
}

export function providerCatalog(flags: { hasStrava: boolean; hasWhoop: boolean; hasFitbit: boolean }): ProviderInfo[] {
  return [
    {
      id: "demo",
      displayName: "Demo watch",
      status: "available",
      connect: "builtin",
      fields: ["steps", "heart rate + zones", "active kcal", "SpO₂", "resting HR", "sleep"],
      note: "Synthetic data so the app works without a watch. Always labeled DEMO.",
    },
    {
      id: "apple_export",
      displayName: "Apple Health (export upload)",
      status: "available",
      connect: "upload",
      fields: ["steps", "heart rate + zones", "active kcal", "SpO₂", "resting HR", "distance"],
      note: "HealthKit is iOS-only, with no web API. Upload export.xml from Health → profile → Export All Health Data.",
    },
    {
      id: "strava",
      displayName: "Strava",
      status: flags.hasStrava ? "available" : "needs_keys",
      connect: "oauth",
      fields: ["distance", "moving time", "avg/max heart rate", "calories"],
      note: flags.hasStrava
        ? "Web OAuth, scope activity:read_all."
        : "Web OAuth. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to enable.",
    },
    {
      id: "whoop",
      displayName: "WHOOP",
      status: flags.hasWhoop ? "available" : "needs_keys",
      connect: "oauth",
      fields: ["recovery", "resting HR", "HRV", "SpO₂", "strain", "sleep"],
      note: "Web OAuth via a WHOOP developer app. Planned (P2).",
    },
    {
      id: "fitbit",
      displayName: "Fitbit",
      status: flags.hasFitbit ? "available" : "needs_keys",
      connect: "oauth",
      fields: ["steps", "heart rate", "SpO₂"],
      note: "Fitbit Web API OAuth. Planned (P2).",
    },
    {
      id: "garmin",
      displayName: "Garmin",
      status: "coming_soon",
      connect: "none",
      fields: [],
      note: "Garmin's Health API needs business approval. On the roadmap.",
    },
    {
      id: "samsung",
      displayName: "Samsung Health",
      status: "coming_soon",
      connect: "none",
      fields: [],
      note: "Samsung Health / Health Connect are Android SDKs only, with no web API. Needs a native wrapper.",
    },
  ];
}
