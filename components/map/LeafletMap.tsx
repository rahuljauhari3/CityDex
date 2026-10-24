"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_BOSTON_CENTER } from "@/lib/geo";
import type { Place } from "@/lib/db/types";
import { rarityHex } from "./rarity";
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
function placeIcon(place: Place): L.DivIcon {
  const fill = rarityHex(place.baselineRarity);
  return L.divIcon({
    className: "",
    html:
      `<div style="` +
      `width:22px;height:22px;background:${fill};` +
      `border:3px solid #5b3a29;box-shadow:2px 2px 0 0 #5b3a29;` +
      `image-rendering:pixelated;` +
      `" aria-hidden="true"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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

export function LeafletMap({ demoMode }: { demoMode: boolean }) {
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
        if (!cancelled) setPlaces(data.places ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full">
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
        <Recenter pos={userPos} />
        {userPos && <Marker position={userPos} icon={uIcon} />}
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={placeIcon(place)}
            eventHandlers={{ click: () => setSelected(place) }}
            keyboard
          />
        ))}
      </MapContainer>

      {geoError && (
        <div
          role="status"
          className="pointer-events-auto absolute inset-x-3 top-3 z-[1000] flex items-center justify-between gap-2 border-4 border-wood-dark bg-parchment px-3 py-2 pixel-shadow"
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

      <PlaceSheet
        place={selected}
        userPos={userPos ? { lat: userPos[0], lng: userPos[1] } : null}
        accuracyM={accuracyM}
        demoMode={demoMode}
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
