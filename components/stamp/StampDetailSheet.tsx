"use client";

import { useEffect, useRef, useState } from "react";
import type { Place, Stamp } from "@/lib/db/types";
import type { PlaceInsight } from "@/lib/insights/place";
import { RARITY_LABEL_HEX, rarityHex } from "@/components/map/rarity";
import { NotMedicalAdvice } from "@/components/health/HealthBits";
import { Sparkline } from "@/components/health/Sparkline";
import { zone2Plus } from "@/lib/health/zones";
import { StampHealthCard } from "./StampHealthCard";

interface Detail {
  place: Place;
  visits: Stamp[];
  insight: PlaceInsight | null;
  totals: { visits: number; points: number; distanceM: number; steps: number; activeKcal: number; zoneMinutes: number };
}

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** Dex stamp details: photo, latest health snapshot, totals and every visit. */
export function StampDetailSheet({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dex/${placeId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Detail) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stamp = detail?.visits[index] ?? null;
  const frame = stamp ? rarityHex(stamp.rarity) : "#5b3a29";

  return (
    <>
      <button type="button" aria-label="Close stamp details" onClick={onClose} className="fixed inset-0 z-[1300] bg-wood-dark/60" />
      <div role="dialog" aria-modal="true" aria-label={detail ? `${detail.place.name} details` : "Stamp details"} className="fixed inset-0 z-[1400] flex items-start justify-center overflow-y-auto p-4">
        <div className="relative w-full max-w-sm bg-parchment p-3 pixel-shadow" style={{ border: `4px solid ${frame}` }}>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 z-10 border-4 border-wood-dark bg-wood-light px-3 py-1 font-label text-sm text-wood-dark">
            ✕
          </button>
          {error && <p className="p-4 text-wood-dark">Couldn&apos;t load this stamp.</p>}
          {!detail && !error && <p className="p-4 font-label text-sm uppercase text-wood-dark/70">Loading…</p>}
          {detail && stamp && (
            <>
              <div className="aspect-[4/3] w-full overflow-hidden border-4 bg-wood-dark/10" style={{ borderColor: frame }}>
                {stamp.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stamp.photoPath} alt={`Your photo of ${detail.place.name}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-sm text-wood-dark/60">No photo for this visit</div>
                )}
              </div>
              <h2 className="mt-3 pr-10 font-heading text-2xl leading-tight text-wood-dark">{detail.place.name}</h2>
              <p className="font-label text-xs uppercase text-wood-dark/75">
                {detail.place.category}
                {detail.place.neighborhood ? ` · ${detail.place.neighborhood}` : ""} ·{" "}
                <span style={{ color: RARITY_LABEL_HEX[stamp.rarity] }}>{stamp.rarity}</span>
              </p>

              <dl className="mt-3 grid grid-cols-4 gap-1 border-y-4 border-wood-dark py-2 text-center">
                {[
                  ["Visits", detail.totals.visits],
                  ["km", (detail.totals.distanceM / 1000).toFixed(1)],
                  ["kcal", detail.totals.activeKcal],
                  ["Z2+ min", detail.totals.zoneMinutes],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-heading text-lg text-activity">{v}</dd>
                    <dt className="font-label text-[10px] uppercase text-wood-dark/75">{k}</dt>
                  </div>
                ))}
              </dl>

              {detail.insight && (
                <div className="mt-2 flex items-end gap-2">
                  <p className="flex-1 text-sm text-wood-dark">{detail.insight.text}</p>
                  <Sparkline
                    values={detail.insight.history.map((h) => h.hr)}
                    muted={new Set(detail.insight.history.flatMap((h, i) => (h.comparable ? [] : [i])))}
                    width={90}
                    height={30}
                    label={`Heart rate on ${detail.insight.visits} visits`}
                  />
                </div>
              )}

              <div className="mt-3">
                <p className="mb-1 font-label text-[11px] uppercase text-wood-dark/75">
                  {index === 0 ? "Latest visit" : "Visit"} · {when(stamp.createdAt)} · +{stamp.points} pts
                </p>
                {stamp.healthSnapshot ? (
                  <StampHealthCard snapshot={stamp.healthSnapshot} />
                ) : (
                  <p className="text-sm text-wood-dark/80">No health data for this visit.</p>
                )}
              </div>

              {detail.visits.length > 1 && (
                <div className="mt-3">
                  <p className="mb-1 font-label text-[11px] uppercase text-wood-dark/75">All visits</p>
                  <ul className="space-y-1">
                    {detail.visits.map((v, i) => {
                      const h = v.healthSnapshot;
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-pressed={i === index}
                            className={`flex w-full justify-between border-2 border-wood-dark px-2 py-1 text-left text-sm ${i === index ? "bg-wood-dark text-parchment" : "bg-parchment text-wood-dark"}`}
                          >
                            <span>{when(v.createdAt)}</span>
                            <span className="font-heading">
                              {h?.distanceM ? `${(h.distanceM / 1000).toFixed(1)} km · ` : ""}
                              {h?.hrAvg ? `${h.hrAvg} bpm · ` : ""}
                              {h ? `${zone2Plus(h.hrZoneMinutes)} Z2+` : "no data"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <NotMedicalAdvice className="mt-3" />
            </>
          )}
        </div>
      </div>
    </>
  );
}
