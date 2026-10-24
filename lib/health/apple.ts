/**
 * Apple Health export parser (PLAN.md §4). Apple has no web API, so the user
 * uploads `export.xml` (Health app → profile → Export All Health Data, then
 * unzip). The file can be hundreds of MB, so this is a streaming, chunked
 * parser that only keeps the record types CityDex uses.
 */

import type { DailyHealth, HealthSnapshot } from "@/lib/db/types";
import { nyDate } from "@/lib/time";
import { zone2Plus, zoneMinutesFromSamples } from "./zones";

export const APPLE_TYPES = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierHeartRate: "hr",
  HKQuantityTypeIdentifierActiveEnergyBurned: "kcal",
  HKQuantityTypeIdentifierOxygenSaturation: "spo2",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distance",
  HKQuantityTypeIdentifierRestingHeartRate: "restingHr",
} as const;

export type AppleKind = (typeof APPLE_TYPES)[keyof typeof APPLE_TYPES];

export interface AppleRecord {
  kind: AppleKind;
  start: number; // epoch ms
  end: number;
  value: number; // steps count, bpm, kcal, SpO2 %, meters
}

/** "2024-05-01 09:55:00 -0400" → epoch ms. */
export function parseAppleDate(s: string): number {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return Date.parse(s);
  return Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

function toRecord(tag: string): AppleRecord | null {
  const type = attr(tag, "type");
  if (!type || !(type in APPLE_TYPES)) return null;
  const kind = APPLE_TYPES[type as keyof typeof APPLE_TYPES];
  const start = parseAppleDate(attr(tag, "startDate") ?? "");
  const end = parseAppleDate(attr(tag, "endDate") ?? "");
  let value = Number(attr(tag, "value"));
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(value)) return null;
  const unit = attr(tag, "unit") ?? "";
  if (kind === "spo2" && value <= 1) value *= 100; // stored as a fraction
  if (kind === "distance") value *= unit === "mi" ? 1609.344 : unit === "km" ? 1000 : 1;
  if (kind === "kcal" && unit === "kJ") value /= 4.184;
  return { kind, start, end, value };
}

/** Feed text chunks in order; call `finish()` to get the records. */
export class AppleHealthParser {
  private buffer = "";
  private records: AppleRecord[] = [];
  private readonly sinceMs: number;
  scanned = 0;

  /** Only keep records newer than `sinceMs` (default: the last 90 days). */
  constructor(sinceMs = Date.now() - 90 * 86_400_000) {
    this.sinceMs = sinceMs;
  }

  push(chunk: string): void {
    this.buffer += chunk;
    let idx = 0;
    for (;;) {
      const open = this.buffer.indexOf("<Record ", idx);
      if (open < 0) {
        // Keep a short tail in case "<Record " is split across chunks.
        this.buffer = this.buffer.slice(Math.max(idx, this.buffer.length - 8));
        return;
      }
      const close = this.buffer.indexOf(">", open);
      if (close < 0) {
        this.buffer = this.buffer.slice(open);
        return;
      }
      this.scanned++;
      const rec = toRecord(this.buffer.slice(open, close + 1));
      if (rec && rec.end >= this.sinceMs) this.records.push(rec);
      idx = close + 1;
    }
  }

  finish(): AppleRecord[] {
    this.buffer = "";
    return this.records.sort((a, b) => a.start - b.start);
  }
}

export function parseAppleHealthXml(xml: string, sinceMs?: number): AppleRecord[] {
  const p = new AppleHealthParser(sinceMs ?? 0);
  p.push(xml);
  return p.finish();
}

/** Share of an interval record that falls inside [from, to]. */
function overlap(r: AppleRecord, from: number, to: number): number {
  const len = Math.max(1, r.end - r.start);
  const o = Math.min(r.end, to) - Math.max(r.start, from);
  if (r.end === r.start) return r.start >= from && r.start <= to ? 1 : 0;
  return Math.max(0, o) / len;
}

/** Health snapshot for a check-in window. */
export function appleSnapshot(records: AppleRecord[], from: Date, to: Date, maxHr?: number): HealthSnapshot | null {
  const f = from.getTime();
  const t = to.getTime();
  let steps = 0, kcal = 0, distance = 0;
  let any = false;
  const hr: { t: number; bpm: number }[] = [];
  const spo2: number[] = [];
  for (const r of records) {
    if (r.end < f || r.start > t) continue;
    const share = overlap(r, f, t);
    if (share <= 0) continue;
    any = true;
    if (r.kind === "steps") steps += r.value * share;
    else if (r.kind === "kcal") kcal += r.value * share;
    else if (r.kind === "distance") distance += r.value * share;
    else if (r.kind === "hr") hr.push({ t: r.start, bpm: r.value });
    else if (r.kind === "spo2") spo2.push(r.value);
  }
  if (!any) return null;
  const snap: HealthSnapshot = {
    source: "apple_export",
    from: from.toISOString(),
    to: to.toISOString(),
    isDemo: false,
    durationMin: Math.round((t - f) / 60_000),
  };
  if (steps > 0) snap.steps = Math.round(steps);
  if (kcal > 0) snap.activeKcal = Math.round(kcal);
  if (distance > 0) snap.distanceM = Math.round(distance);
  if (hr.length) {
    snap.hrAvg = Math.round(hr.reduce((s, x) => s + x.bpm, 0) / hr.length);
    snap.hrMax = Math.round(Math.max(...hr.map((x) => x.bpm)));
    snap.hrZoneMinutes = zoneMinutesFromSamples(hr, maxHr);
  }
  if (spo2.length) snap.spo2Avg = Math.round((spo2.reduce((s, x) => s + x, 0) / spo2.length) * 10) / 10;
  return snap;
}

/** Daily totals by America/New_York date. */
export function appleDaily(records: AppleRecord[]): DailyHealth[] {
  const days = new Map<string, { steps: number; kcal: number; hr: { t: number; bpm: number }[]; resting: number[]; spo2: number[] }>();
  for (const r of records) {
    const date = nyDate(new Date(r.start));
    let d = days.get(date);
    if (!d) {
      d = { steps: 0, kcal: 0, hr: [], resting: [], spo2: [] };
      days.set(date, d);
    }
    if (r.kind === "steps") d.steps += r.value;
    else if (r.kind === "kcal") d.kcal += r.value;
    else if (r.kind === "hr") d.hr.push({ t: r.start, bpm: r.value });
    else if (r.kind === "restingHr") d.resting.push(r.value);
    else if (r.kind === "spo2") d.spo2.push(r.value);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
  return [...days.entries()].map(([date, d]) => {
    const resting = avg(d.resting);
    const spo2 = avg(d.spo2);
    return {
      date,
      source: "apple_export" as const,
      isDemo: false,
      steps: Math.round(d.steps),
      activeKcal: Math.round(d.kcal),
      zoneMinutes: d.hr.length ? zone2Plus(zoneMinutesFromSamples(d.hr)) : undefined,
      restingHr: resting !== undefined ? Math.round(resting) : undefined,
      spo2Avg: spo2 !== undefined ? Math.round(spo2 * 10) / 10 : undefined,
    };
  });
}
