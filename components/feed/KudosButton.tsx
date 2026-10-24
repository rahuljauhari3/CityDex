"use client";

import { useState } from "react";

export function KudosButton({ stampId, count, given, own }: { stampId: string; count: number; given: boolean; own: boolean }) {
  const [state, setState] = useState({ count, given });
  async function toggle() {
    const optimistic = { count: state.count + (state.given ? -1 : 1), given: !state.given };
    setState(optimistic);
    const res = await fetch("/api/kudos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stampId }),
    });
    if (!res.ok) setState(state);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={own}
      aria-pressed={state.given}
      className={`flex items-center gap-1 border-2 border-wood-dark px-2 py-1 font-label text-xs uppercase ${
        state.given ? "bg-activity text-parchment" : "bg-parchment text-wood-dark"
      } disabled:opacity-70`}
    >
      <span aria-hidden="true">🙌</span> {own ? "High fives" : state.given ? "High-fived" : "High five"} · {state.count}
    </button>
  );
}
