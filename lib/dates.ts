/** Dates for the shop, in Houston time (America/Chicago), DST included. */
const TZ = "America/Chicago";

/** Minutes Houston is behind UTC at the given moment. */
function offsetMinutes(at: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(new Date(at))
      .map((p) => [p.type, Number(p.value)]),
  );
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((at - wall) / 60000);
}

/** "2026-10-31" → the first moment after that day ends in Houston, as ISO. Null if not a date. */
export function endOfDayHouston(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const midnightUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1);
  return new Date(midnightUtc + offsetMinutes(midnightUtc) * 60000).toISOString();
}

/** ISO moment → the Houston calendar day it falls in ("2026-10-31"), for <input type="date">. */
export const houstonDay = (at: number) => new Date(at).toLocaleDateString("en-CA", { timeZone: TZ });
