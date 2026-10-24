"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelPanel } from "@/components/ui/PixelPanel";

interface FriendRow {
  userId: string;
  username: string;
  avatarEmoji: string;
  status: "pending" | "accepted";
  incoming: boolean;
}

export function FriendsPanel({ friends, inviteCode }: { friends: FriendRow[]; inviteCode: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function send(body: Record<string, string>) {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? data.message : data.error ?? "Couldn't do that.");
    if (res.ok) setQ("");
    router.refresh();
  }

  return (
    <PixelPanel>
      <h2 className="font-heading text-xl text-wood-dark">Friends</h2>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) send({ action: "add", query: q.trim() });
        }}
      >
        <label className="sr-only" htmlFor="friend-q">Username or invite code</label>
        <input
          id="friend-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="username or invite code"
          className="min-w-0 flex-1 border-2 border-wood-dark bg-parchment px-2 py-1 text-base text-wood-dark"
        />
        <button type="submit" className="border-2 border-wood-dark bg-activity px-3 font-label text-xs uppercase text-parchment">
          Add
        </button>
      </form>
      <p className="mt-1 text-xs text-wood-dark/75">Your invite code: <span className="font-label">{inviteCode}</span></p>
      {msg && <p role="status" className="mt-1 text-sm text-wood-dark">{msg}</p>}
      <ul className="mt-2 space-y-1">
        {friends.map((f) => (
          <li key={f.userId} className="flex items-center justify-between text-sm text-wood-dark">
            <span>
              <span aria-hidden="true">{f.avatarEmoji}</span> @{f.username}
              {f.status === "pending" && <span className="ml-1 text-xs text-wood-dark/70">{f.incoming ? "wants to be friends" : "request sent"}</span>}
            </span>
            {f.incoming && (
              <button type="button" onClick={() => send({ action: "accept", userId: f.userId })} className="border-2 border-wood-dark bg-grass px-2 py-0.5 font-label text-[10px] uppercase text-wood-dark">
                Accept
              </button>
            )}
          </li>
        ))}
      </ul>
    </PixelPanel>
  );
}
