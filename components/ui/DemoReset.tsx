"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Demo-only: restore the seeded demo world before a presentation. */
export function DemoReset() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  async function reset() {
    setState("busy");
    await fetch("/api/demo/reset", { method: "POST" });
    try {
      sessionStorage.removeItem("citydex.route");
    } catch {
      // ignore
    }
    setState("done");
    router.push("/map");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={reset}
      disabled={state === "busy"}
      className="mt-3 w-full border-2 border-wood-dark bg-wood-light px-3 py-1.5 font-label text-xs uppercase text-wood-dark"
    >
      {state === "busy" ? "Resetting…" : state === "done" ? "Demo reset ✓" : "Reset demo data"}
    </button>
  );
}
