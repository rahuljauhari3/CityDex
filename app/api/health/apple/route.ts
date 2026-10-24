/**
 * POST /api/health/apple: upload Apple Health `export.xml` as the raw request
 * body. Streamed through the chunked parser so large exports don't need to
 * fit in memory as one string. Only the last 90 days of supported types are kept.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { AppleHealthParser } from "@/lib/health/apple";
import { nyDate } from "@/lib/time";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

export async function POST(request: Request) {
  if (!request.body) return NextResponse.json({ error: "Upload export.xml as the request body." }, { status: 400 });
  const parser = new AppleHealthParser();
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let sawHealthData = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "File is larger than 1 GB." }, { status: 413 });
    const text = decoder.decode(value, { stream: true });
    if (!sawHealthData && text.includes("<HealthData")) sawHealthData = true;
    parser.push(text);
  }
  parser.push(decoder.decode());
  const records = parser.finish();
  if (!sawHealthData) {
    return NextResponse.json({ error: "That doesn't look like an Apple Health export.xml." }, { status: 422 });
  }
  if (records.length === 0) {
    return NextResponse.json({ error: "No steps, heart rate, energy or SpO₂ records from the last 90 days." }, { status: 422 });
  }

  const store = getStore();
  await store.setAppleRecords(DEMO_USER_ID, records);
  const dates = new Set(records.map((r) => nyDate(new Date(r.start))));
  const sorted = [...dates].sort();
  await store.saveConnection({
    userId: DEMO_USER_ID,
    provider: "apple_export",
    connectedAt: new Date().toISOString(),
    meta: { records: records.length, scanned: parser.scanned, firstDate: sorted[0], lastDate: sorted.at(-1) },
  });
  return NextResponse.json({ ok: true, records: records.length, days: dates.size });
}
