/**
 * Calendar helpers pinned to America/New_York (PLAN.md §7: weekly reset is
 * Monday 00:00 Boston time).
 */

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for the Boston calendar day containing `d`. */
export function nyDate(d: Date): string {
  return fmt.format(d);
}

/** Hour of day (0–23) in Boston. */
export function nyHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(d),
  );
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the Boston week containing `d`. */
export function nyWeekStart(d: Date): string {
  const date = nyDate(d);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

/** The 7 dates of the week starting `weekStart`. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Share of the Boston day elapsed so far (0–1), for partial-day demo data. */
export function nyDayProgress(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return Math.min(1, Math.max(0.05, (h * 60 + m) / (22 * 60)));
}
