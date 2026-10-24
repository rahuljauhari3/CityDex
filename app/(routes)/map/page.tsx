import type { Metadata } from "next";
import { MapScreen } from "@/components/map/MapScreen";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = {
  title: "Map · CityDex",
};

export default function MapPage() {
  // isDemoMode is read server-side; pass it down so the collect flow can offer
  // the demo "teleport" option without leaking any secret-bearing env var.
  return <MapScreen demoMode={isDemoMode} />;
}
