import type { PnlMode } from "./stats";

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

export function rangeStart(range: RangeId, now = new Date()): Date | null {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  switch (range) {
    case "30d":
      d.setDate(d.getDate() - 30);
      return d;
    case "90d":
      d.setDate(d.getDate() - 90);
      return d;
    case "ytd":
      return new Date(d.getFullYear(), 0, 1);
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
