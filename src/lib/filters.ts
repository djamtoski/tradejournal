import type { PnlMode } from "./stats";
import { addDaysKey, dayKey, startOfDay } from "./tz";

export const ranges = [
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "All" },
] as const;

export type RangeId = (typeof ranges)[number]["id"];

export type Filters = { range: RangeId; mode: PnlMode };

type SearchParams = Record<string, string | string[] | undefined>;

export function parseFilters(sp: SearchParams): Filters {
  const range = ranges.some((r) => r.id === sp.range) ? (sp.range as RangeId) : "90d";
  const mode: PnlMode = sp.mode === "gross" ? "gross" : "net";
  return { range, mode };
}

/** Start instant of a range, counted in whole days of the trading timezone. */
export function rangeStart(range: RangeId, tz: string, now = new Date()): Date | null {
  const today = dayKey(now, tz);
  switch (range) {
    case "30d":
      return startOfDay(addDaysKey(today, -30), tz);
    case "90d":
      return startOfDay(addDaysKey(today, -90), tz);
    case "ytd":
      return startOfDay(`${today.slice(0, 4)}-01-01`, tz);
    case "all":
      return null;
  }
}

export function filterHref(current: Filters, patch: Partial<Filters>, path = "/") {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.range !== "90d") params.set("range", next.range);
  if (next.mode !== "net") params.set("mode", next.mode);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
