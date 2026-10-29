import { ranges, type RangeId } from "@/lib/filters";
import { pnlOf, type PnlMode } from "@/lib/stats";
import type { JournalTrade } from "@/lib/queries";

export const sortKeys = ["date", "symbol", "pnl", "qty", "duration"] as const;
export type SortKey = (typeof sortKeys)[number];

export type TradeFilters = {
  range: RangeId;
  mode: PnlMode;
  q: string;
  side: "" | "long" | "short";
  result: "" | "win" | "loss";
  tag: string;
  rules: "" | "yes" | "no" | "unset";
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  trade: number | null;
};

const defaults: TradeFilters = {
  range: "90d", mode: "net", q: "", side: "", result: "", tag: "", rules: "",
  sort: "date", dir: "desc", page: 1, trade: null,
};

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function parseTradeFilters(sp: SP): TradeFilters {
  const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T) =>
    (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  const page = Number.parseInt(str(sp.page), 10);
  const trade = Number.parseInt(str(sp.trade), 10);
  return {
    range: pick(str(sp.range), ranges.map((r) => r.id), defaults.range),
    mode: str(sp.mode) === "gross" ? "gross" : "net",
    q: str(sp.q).trim().slice(0, 32),
    side: pick(str(sp.side), ["", "long", "short"] as const, ""),
    result: pick(str(sp.result), ["", "win", "loss"] as const, ""),
    tag: str(sp.tag).slice(0, 64),
    rules: pick(str(sp.rules), ["", "yes", "no", "unset"] as const, ""),
    sort: pick(str(sp.sort), sortKeys, "date"),
    dir: str(sp.dir) === "asc" ? "asc" : "desc",
    page: page > 0 ? page : 1,
    trade: trade > 0 ? trade : null,
  };
}

/** URL for the trades page with some filters changed. Non-default values only. */
export function tradesHref(f: TradeFilters, patch: Partial<TradeFilters> = {}) {
  const next = { ...f, ...patch };
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof TradeFilters)[]) {
    const v = next[key];
    if (v !== null && v !== "" && v !== defaults[key]) params.set(key, String(v));
  }
  const qs = params.toString();
  return qs ? `/trades?${qs}` : "/trades";
}

export function applyTradeFilters(trades: JournalTrade[], f: TradeFilters) {
  const q = f.q.toUpperCase();
  const filtered = trades.filter((t) => {
    if (q && !t.symbol.includes(q)) return false;
    if (f.side && t.side !== f.side) return false;
    const pnl = pnlOf(t, f.mode);
    if (f.result === "win" && pnl <= 0) return false;
    if (f.result === "loss" && pnl >= 0) return false;
    if (f.tag && !t.tags.includes(f.tag) && !t.mistakes.includes(f.tag)) return false;
    if (f.rules === "yes" && t.followedRules !== true) return false;
    if (f.rules === "no" && t.followedRules !== false) return false;
    if (f.rules === "unset" && t.followedRules !== null) return false;
    return true;
  });

  const value = (t: JournalTrade): number | string => {
    switch (f.sort) {
      case "symbol": return t.symbol;
      case "pnl": return pnlOf(t, f.mode);
      case "qty": return t.quantity;
      case "duration": return t.closedAt.getTime() - t.openedAt.getTime();
      default: return t.openedAt.getTime();
    }
  };
  const sign = f.dir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    const va = value(a), vb = value(b);
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return cmp * sign || (b.openedAt.getTime() - a.openedAt.getTime());
  });
}
