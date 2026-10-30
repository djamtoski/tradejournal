/**
 * Shared filters, remembered in a cookie so every page shows the same slice of
 * trades. Safe to import from client components; the server reader lives in
 * ./filters-server.ts.
 */
import type { PnlMode } from "./stats";
import { addDaysKey, dayKey, startOfDay } from "./tz";

export const ranges = [
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "All" },
] as const;
export type RangeId = (typeof ranges)[number]["id"];

export const groupings = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;
export type Grouping = (typeof groupings)[number]["id"];

export const assetClassOptions = [
  { id: "stock", label: "Stocks" },
  { id: "future", label: "Futures" },
  { id: "forex", label: "Forex" },
  { id: "option", label: "Options" },
  { id: "cfd", label: "CFDs" },
] as const;
export type AssetClassId = (typeof assetClassOptions)[number]["id"];

export type Filters = {
  range: RangeId;
  mode: PnlMode;
  /** Empty means every account. */
  accountIds: number[];
  /** Empty means every asset class. */
  assetClasses: AssetClassId[];
  grouping: Grouping;
};

/** The part of the filters that narrows which trades are loaded. */
export type Scope = Pick<Filters, "accountIds" | "assetClasses">;

export const FILTER_COOKIE = "ledger-filters";

export const defaultFilters: Filters = {
  range: "90d",
  mode: "net",
  accountIds: [],
  assetClasses: [],
  grouping: "day",
};

const isOneOf = <T extends string>(v: unknown, options: readonly { id: T }[]): v is T =>
  typeof v === "string" && options.some((o) => o.id === v);

/** Reads a cookie value; anything malformed falls back to defaults field by field. */
export function parseFilterCookie(raw: string | undefined | null): Filters {
  let data: Record<string, unknown> = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
  } catch {
    // keep defaults
  }
  const ids = Array.isArray(data.accountIds)
    ? [...new Set(data.accountIds.filter((n): n is number => Number.isInteger(n) && n > 0))].slice(0, 100)
    : [];
  const classes = Array.isArray(data.assetClasses)
    ? [...new Set(data.assetClasses.filter((c): c is AssetClassId => isOneOf(c, assetClassOptions)))]
    : [];
  return {
    range: isOneOf(data.range, ranges) ? data.range : defaultFilters.range,
    mode: data.mode === "gross" ? "gross" : "net",
    accountIds: ids,
    assetClasses: classes,
    grouping: isOneOf(data.grouping, groupings) ? data.grouping : defaultFilters.grouping,
  };
}

export const serializeFilters = (f: Filters) => JSON.stringify(f);

/** URL params that override the cookie for one page view (deep links like "all trades"). */
export function applyUrlOverrides(f: Filters, sp: Record<string, string | string[] | undefined>): Filters {
  const next = { ...f };
  if (isOneOf(sp.range, ranges)) next.range = sp.range;
  if (sp.mode === "gross" || sp.mode === "net") next.mode = sp.mode;
  return next;
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
