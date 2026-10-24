"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PixelPanel } from "@/components/ui/PixelPanel";

export interface SourceView {
  id: string;
  displayName: string;
  status: "available" | "needs_keys" | "coming_soon";
  connect: "builtin" | "oauth" | "upload" | "none";
  fields: string[];
  note: string;
  connected: boolean;
  connectedAt: string | null;
  meta: Record<string, unknown> | null;
}

/**
 * Health sources (PLAN §4, §11): explicit opt-in per provider, shows which
 * fields are pulled, and Disconnect deletes the tokens / imported data.
 */
export function HealthSources({ sources }: { sources: SourceView[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(provider: string, method: "POST" | "DELETE") {
    setBusy(provider);
    setMessage(null);
    const res = await fetch(`/api/health/connections?provider=${provider}`, { method });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setMessage(data.error ?? "Something went wrong.");
    router.refresh();
  }

  async function upload(file: File) {
    setBusy("apple_export");
    setMessage(`Reading ${file.name}…`);
    const res = await fetch("/api/health/apple", { method: "POST", body: file, headers: { "content-type": "application/xml" } });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setMessage(res.ok ? `Imported ${data.records?.toLocaleString()} records over ${data.days} days.` : data.error ?? "Import failed.");
    router.refresh();
  }

  return (
    <PixelPanel>
      <h2 className="font-heading text-xl text-wood-dark">Health sources</h2>
      <p className="text-sm text-wood-dark/80">You choose what to connect. Disconnecting deletes the tokens and imported data.</p>
      <input
        ref={fileRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      <ul className="mt-3 space-y-3">
        {sources.map((s) => (
          <li key={s.id} className="border-t-2 border-wood-dark/30 pt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-base text-wood-dark">
                {s.displayName}
                {s.connected && <span className="ml-1 font-label text-[10px] uppercase text-grass">● connected</span>}
              </p>
              {s.connected ? (
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => call(s.id, "DELETE")}
                  className="border-2 border-wood-dark bg-parchment px-2 py-1 font-label text-xs uppercase text-wood-dark"
                >
                  Disconnect
                </button>
              ) : s.status === "coming_soon" ? (
                <span className="font-label text-[10px] uppercase text-wood-dark/70">Coming soon</span>
              ) : s.status === "needs_keys" ? (
                <span className="font-label text-[10px] uppercase text-wood-dark/70">Needs keys</span>
              ) : s.connect === "upload" ? (
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-wood-dark bg-activity px-2 py-1 font-label text-xs uppercase text-parchment"
                >
                  {busy === s.id ? "Importing…" : "Upload"}
                </button>
              ) : s.connect === "oauth" ? (
                <a
                  href={`/api/health/${s.id}/connect`}
                  className="border-2 border-wood-dark bg-activity px-2 py-1 font-label text-xs uppercase text-parchment"
                >
                  Connect
                </a>
              ) : (
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => call(s.id, "POST")}
                  className="border-2 border-wood-dark bg-activity px-2 py-1 font-label text-xs uppercase text-parchment"
                >
                  Connect
                </button>
              )}
            </div>
            {s.fields.length > 0 && <p className="text-xs text-wood-dark/80">Reads: {s.fields.join(", ")}</p>}
            <p className="text-xs text-wood-dark/70">{s.note}</p>
            {s.connected && s.meta?.records !== undefined && (
              <p className="text-xs text-wood-dark/80">
                {Number(s.meta.records).toLocaleString()} records, {String(s.meta.firstDate)} → {String(s.meta.lastDate)}
              </p>
            )}
          </li>
        ))}
      </ul>
      {message && <p role="status" className="mt-2 text-sm text-wood-dark">{message}</p>}
    </PixelPanel>
  );
}
