"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_BOSTON_CENTER } from "@/lib/geo";
import type { Place } from "@/lib/db/types";
import { RARITY_HEX, rarityHex } from "./rarity";
import { useRouteTracker } from "./useRouteTracker";
import { LiveWalkPanel } from "./LiveWalkPanel";
import { PlaceSheet } from "./PlaceSheet";

const BOSTON: [number, number] = [
  DEFAULT_BOSTON_CENTER.lat,
  DEFAULT_BOSTON_CENTER.lng,
];

/**
 * Pixel/wooden rarity marker as a Leaflet `divIcon`. Using a divIcon avoids the
 * default marker PNG assets, which 404 under bundlers, and lets us color the
 * pin by rarity (REQ-2.3).
 */
function placeIcon(place: Place, quest: boolean): L.DivIcon {
  const fill = rarityHex(place.baselineRarity);
  const size = quest ? 22 : 16;
  const ring = quest ? "outline:3px solid #fc5200;outline-offset:2px;" : "";
  return L.divIcon({
    className: "",
    html:
      `<div style="` +
      `width:${size}px;height:${size}px;background:${fill};` +
      `border:3px solid #5b3a29;box-shadow:2px 2px 0 0 #5b3a29;${ring}` +
      `image-rendering:pixelated;` +
      `" aria-hidden="true"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function userIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      `<div style="width:16px;height:16px;background:#fc5200;` +
      `border:3px solid #ffffff;box-shadow:0 0 0 2px #5b3a29;border-radius:50%;` +
      `"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Recenter the map once on the first real user fix. */
function Recenter({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (pos && !done.current) {
      done.current = true;
      map.setView(pos, 14, { animate: false });
    }
  }, [pos, map]);
  return null;
}

/** Pan to a place opened from a quest link. */
function FocusPlace({ place }: { place: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (place) map.setView([place.lat, place.lng], 15, { animate: false });
  }, [place, map]);
  return null;
}

export function LeafletMap({
  demoMode,
  focusPlaceId,
  questIds,
}: {
  demoMode: boolean;
  focusPlaceId?: string | null;
  questIds: string[];
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);

  // Fetch places once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/places")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((data: { places: Place[] }) => {
        if (cancelled) return;
        setPlaces(data.places ?? []);
        const focus = focusPlaceId ? data.places?.find((p) => p.id === focusPlaceId) : null;
        if (focus) setSelected(focus);
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [focusPlaceId]);

  // Watch live position; non-blocking error handling (REQ-2.2, REQ-2.5).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // Defer so we don't setState synchronously inside the effect body.
      const t = setTimeout(
        () =>
          setGeoError(
            "Location isn’t available on this device. Showing Boston.",
          ),
        0,
      );
      return () => clearTimeout(t);
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setUserPos([p.coords.latitude, p.coords.longitude]);
        setAccuracyM(
          typeof p.coords.accuracy === "number" ? p.coords.accuracy : null,
        );
        setGeoError(null);
      },
      () => setGeoError("Couldn’t get your location. Showing Boston."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const uIcon = useMemo(() => userIcon(), []);
  const quests = useMemo(() => new Set(questIds), [questIds]);
  const gpsPos = useMemo(() => (userPos ? { lat: userPos[0], lng: userPos[1] } : null), [userPos]);
  const tracker = useRouteTracker(gpsPos, accuracyM);
  // During a simulated demo walk, "you" are wherever the simulation is.
  const pos = tracker.position ?? gpsPos;
  const markerPos: [number, number] | null = pos ? [pos.lat, pos.lng] : null;

  function startWalk() {
    if (gpsPos || !demoMode) {
      tracker.start();
      return;
    }
    // No GPS in demo mode: simulate a walk to the open place or today's top quest.
    const target = selected ?? places.find((p) => p.id === questIds[0]) ?? null;
    if (target) {
      tracker.simulate({ lat: target.lat, lng: target.lng }, target.name);
      setSelected(null);
      setGeoError(null);
    }
  }
  const focusPlace = useMemo(
    () => (focusPlaceId ? places.find((p) => p.id === focusPlaceId) ?? null : null),
    [focusPlaceId, places],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={BOSTON}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        {focusPlace ? <FocusPlace place={focusPlace} /> : <Recenter pos={userPos} />}
        {tracker.points.length > 1 && (
          <Polyline positions={tracker.points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#fc5200", weight: 5, dashArray: tracker.simulated ? "6 6" : undefined }} />
        )}
        {markerPos && <Marker position={markerPos} icon={uIcon} />}
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={placeIcon(place, quests.has(place.id))}
            eventHandlers={{ click: () => setSelected(place) }}
            keyboard
          />
        ))}
      </MapContainer>

      {/* Walk tracking + rarity legend (bottom-left, above the attribution). */}
      <div className="absolute bottom-6 left-2 z-[1000] flex flex-col items-start gap-2">
        {!tracker.active && (
          <button
            type="button"
            onClick={startWalk}
            className="pixel-shadow border-4 border-wood-dark bg-activity px-3 py-1.5 font-heading text-sm text-parchment"
          >
            {gpsPos || !demoMode ? "▶ Start walk" : "▶ Demo walk to quest"}
          </button>
        )}
        <div className="flex gap-1 border-2 border-wood-dark bg-parchment/95 px-1.5 py-1" aria-label="Rarity legend">
          {(Object.keys(RARITY_HEX) as (keyof typeof RARITY_HEX)[]).map((r) => (
            <span key={r} className="flex items-center gap-0.5 font-label text-[9px] uppercase text-wood-dark">
              <span className="inline-block h-2.5 w-2.5 border border-wood-dark" style={{ background: RARITY_HEX[r] }} />
              {r.slice(0, 3)}
            </span>
          ))}
        </div>
      </div>

      {geoError && (
        <div
          role="status"
          className="pointer-events-auto absolute inset-x-3 bottom-28 z-[1000] flex items-center justify-between gap-2 border-4 border-wood-dark bg-parchment px-3 py-2 pixel-shadow"
        >
          <span className="text-sm text-wood-dark">{geoError}</span>
          <button
            type="button"
            onClick={() => setGeoError(null)}
            aria-label="Dismiss location message"
            className="font-label text-sm text-wood-dark underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <LiveWalkPanel
        tracker={tracker}
        onArrivedCollect={() => {
          const t = tracker.target;
          const place = t ? places.find((p) => p.lat === t.position.lat && p.lng === t.position.lng) : null;
          if (place) setSelected(place);
        }}
      />

      <PlaceSheet
        place={selected}
        userPos={pos}
        accuracyM={tracker.simulated ? 5 : accuracyM}
        demoMode={demoMode}
        route={tracker.active ? { startedAt: tracker.startedAt!, distanceM: tracker.distanceM, elapsedMs: tracker.elapsedMs, simulated: tracker.simulated } : null}
        onRouteUsed={tracker.stop}
        onClose={() => setSelected(null)}
        onCollected={({ place: updatedPlace }) => {
          // Reflect the incremented collect count on the map + sheet.
          setPlaces((prev) =>
            prev.map((p) => (p.id === updatedPlace.id ? updatedPlace : p)),
          );
          setSelected((cur) =>
            cur && cur.id === updatedPlace.id ? updatedPlace : cur,
          );
        }}
      />
    </div>
  );
}
