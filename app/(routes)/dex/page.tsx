import type { Metadata } from "next";
import { DexScreen } from "@/components/stamp/DexScreen";

export const metadata: Metadata = {
  title: "Dex · CityDex",
};

export default function DexPage() {
  return <DexScreen />;
}
