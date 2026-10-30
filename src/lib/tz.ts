/**
 * Trading-timezone helpers. Trade times are instants (Date); calendar days are
 * "YYYY-MM-DD" keys in the trading timezone. Converting between the two only
 * happens here, so the machine's own clock never decides which day a trade is on.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
};

/** Wall-clock fields of an instant in `tz`. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
    weekday: weekdayIndex[p.weekday],
  };
}

/** Calendar day of an instant in `tz`, as "YYYY-MM-DD". */
export function dayKey(date: Date, tz: string) {
  const { year, month, day } = zonedParts(date, tz);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Offset of `tz` from UTC at an instant, in ms (positive east of UTC). */
function offsetAt(ms: number, tz: string) {
  const p = zonedParts(new Date(ms), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant at a wall-clock time in `tz`. Times skipped by a DST jump resolve
 * forward (02:30 on spring-forward day becomes 03:30); repeated times take the first.
 */
export function zonedInstant(
  tz: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // Guess with the offset at the wall time, then correct once with the offset at the guess.
  const guess = wall - offsetAt(wall, tz);
  const offset = offsetAt(guess, tz);
  if (offset === offsetAt(wall, tz)) return new Date(guess);
  const corrected = wall - offset;
  if (offsetAt(corrected, tz) === offset) return new Date(corrected);
  // Neither guess is self-consistent: the wall time falls in a DST gap. Resolve forward.
  return new Date(Math.max(guess, corrected));
}

/** Instant when calendar day `key` starts in `tz`. */
export function startOfDay(key: string, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return zonedInstant(tz, y, m, d);
}

/** Day key `n` days after `key` (pure calendar arithmetic). */
export function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Format an instant's time of day in `tz`, 24-hour. */
export const formatTime = (date: Date, tz: string, seconds = false) =>
  date.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
  });

/** Format an instant with a date and time in `tz`. */
export const formatDateTime = (date: Date, tz: string, opts: Intl.DateTimeFormatOptions = {}) =>
  date.toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...opts,
  });

/** Short label like "UTC−4" for `tz` at an instant. */
export function offsetLabel(tz: string, at = new Date()) {
  const mins = Math.round(offsetAt(at.getTime(), tz) / 60_000);
  if (!mins) return "UTC";
  const sign = mins > 0 ? "+" : "−";
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `UTC${sign}${h}${m ? `:${pad(m)}` : ""}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
