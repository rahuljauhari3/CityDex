"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Account deletion removes photos, stamps, health snapshots and tokens (PLAN §11). */
export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  async function remove() {
    await fetch("/api/account", { method: "DELETE" });
    setDone(true);
    setConfirming(false);
    router.refresh();
  }

  if (done) return <p role="status" className="mt-3 text-sm text-wood-dark">Your data was deleted.</p>;
  return confirming ? (
    <div className="mt-3 border-2 border-berry p-2">
      <p className="text-sm text-wood-dark">Delete all your photos, stamps, health snapshots and connected-source tokens?</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={remove} className="border-2 border-wood-dark bg-berry px-3 py-1 font-label text-xs uppercase text-parchment">
          Delete everything
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="border-2 border-wood-dark px-3 py-1 font-label text-xs uppercase text-wood-dark">
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className="mt-3 font-label text-xs uppercase text-berry underline">
      Delete my account and data
    </button>
  );
}
