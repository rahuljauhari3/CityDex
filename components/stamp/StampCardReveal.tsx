"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Stamp } from "@/lib/db/types";
import { rarityHex, RARITY_LABEL_HEX } from "@/components/map/rarity";

const CATEGORY_LABEL: Record<string, string> = {
  mural: "Mural",
  statue: "Statue",
  cafe: "Café",
  door: "Door",
  park: "Park",
  building: "Building",
  transit: "Transit",
  water: "Water",
  nature: "Nature",
  shop: "Shop",
  oddity: "Oddity",
  other: "Spot",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Stamp-card reveal (ui.md "Stamp card", REQ-5.1, 5.4, 5.5): parchment card
 * with a rarity-colored glowing frame, the photo shown **exactly as uploaded**
 * (no filter, no dither), the place name in a pixel font, a category label, and
 * a stats row with orange numbers. The stats row is structured so B1 can drop
 * distance/steps/HR/kcal in beside the points.
 *
 * Accessibility: role="dialog" aria-modal, Close focused on mount, Escape
 * closes, focus trapped. Glow/flip are gated on prefers-reduced-motion (JS +
 * the globals.css reduce block). A muted-by-default haptic "pop" fires only
 * when motion is not reduced.
 */
export function StampCardReveal({
  stamp,
  place,
  onClose,
}: {
  stamp: Stamp;
  place?: { name: string; neighborhood: string | null } | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Read once on mount via a lazy initializer. prefersReducedMotion() guards
  // for SSR (returns false when window/matchMedia is absent), so the first
  // client render matches and we avoid a cascading setState-in-effect.
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const isReduced = reduced;

    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap focus within the dialog (WCAG 2.4.3). The backdrop is a sibling
      // button outside the dialog, so Tab must cycle among the dialog's own
      // focusable controls only.
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    // Muted-by-default "pop": a short haptic tick, only when motion is allowed.
    if (!isReduced && typeof navigator !== "undefined") {
      navigator.vibrate?.(30);
    }

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, reduced]);

  const card = stamp.card;
  const rarity = stamp.rarity;
  const frameHex = rarityHex(rarity);
  const placeName = place?.name ?? card.name;

  return (
    <>
      <button
        type="button"
        aria-label="Close stamp card"
        onClick={onClose}
        className="fixed inset-0 z-[1300] bg-wood-dark/60"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${card.name} — ${rarity} stamp`}
        className="fixed inset-0 z-[1400] flex items-center justify-center p-4"
      >
        <div
          className={`${reduced ? "" : "card-reveal rarity-glow"} relative w-full max-w-xs bg-parchment p-3`}
          style={
            {
              border: `4px solid ${frameHex}`,
              boxShadow: "4px 4px 0 0 var(--color-wood-dark)",
              ["--rarity-glow"]: frameHex,
            } as CSSProperties
          }
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 z-10 border-4 border-wood-dark bg-wood-light px-3 py-1 font-label text-sm text-wood-dark"
          >
            ✕
          </button>

          {/* Photo shown exactly as uploaded — no filter, no dither (REQ-4.5). */}
          <div
            className="relative aspect-square w-full overflow-hidden border-4 border-wood-dark bg-wood-dark/10"
            style={{ borderColor: frameHex }}
          >
            {stamp.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stamp.photoPath}
                alt={`Photo of ${card.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-heading text-4xl text-wood-dark/50">
                ?
              </div>
            )}
          </div>

          {/* Name + category/rarity label. */}
          <h2 className="mt-3 font-heading text-2xl leading-tight text-wood-dark">
            {card.name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 font-label text-xs uppercase tracking-wide">
            <span
              aria-hidden="true"
              className="pixelated inline-block h-3 w-3 border-2 border-wood-dark"
              style={{ background: frameHex }}
            />
            <span className="text-wood-dark/70">
              {CATEGORY_LABEL[card.category] ?? card.category}
            </span>
            <span aria-hidden="true" className="text-wood-dark/40">
              ·
            </span>
            <span
              className="font-heading capitalize"
              style={{ color: RARITY_LABEL_HEX[rarity] }}
            >
              {rarity}
            </span>
          </p>

          {/* Stats row — orange numbers. B1 adds distance/steps/HR/kcal cells. */}
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t-4 border-wood-dark pt-3 text-sm">
            <div>
              <dt className="font-label text-xs uppercase tracking-wide text-wood-dark/70">
                Earned
              </dt>
              <dd className="font-heading text-xl text-activity">
                +{stamp.points} pts
              </dd>
            </div>
            <div>
              <dt className="font-label text-xs uppercase tracking-wide text-wood-dark/70">
                Place
              </dt>
              <dd className="font-heading text-wood-dark">{placeName}</dd>
            </div>
          </dl>

          {/* Health stats land in B1. */}
          <p className="mt-2 font-label text-[11px] text-wood-dark/60">
            Health stats attach on your next check-in.
          </p>
        </div>
      </div>
    </>
  );
}
