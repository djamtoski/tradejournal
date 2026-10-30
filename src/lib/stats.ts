/** Pure metric helpers. Inputs are closed trades; no DB access here. */
import { addDaysKey } from "./tz";

export type StatTrade = {
  id: number;
  symbol: string;
  side: "long" | "short";
  closedAt: Date;
  openedAt: Date;
  grossPnl: number;
  netPnl: number;
  tags: string[];
  mistakes?: string[];
  /** Trading-timezone calendar day the trade closed on ("YYYY-MM-DD"). */
  day: string;
  /** Trading-timezone hour (0–23) and weekday (0 = Sunday) the trade opened. */
  openHour: number;
  openWeekday: number;
  /** Dollars at risk (1R) for this trade, or null when neither a stop nor an account default is set. */
  risk?: number | null;
  assetClass?: string;
  entryPrice?: number;
  followedRules?: boolean | null;
};

export type PnlMode = "net" | "gross";

export const pnlOf = (t: StatTrade, mode: PnlMode) =>
  mode === "net" ? t.netPnl : t.grossPnl;

/**
 * 1R in dollars: the planned loss to the stop when one is set, otherwise the
 * account's default risk per trade. Null when neither is known.
 */
export function riskOf(t: {
  entryPrice: number;
  stopPrice: number | null;
  quantity: number;
  multiplier: number;
  defaultRisk: number | null;
}): number | null {
  if (t.stopPrice !== null && Number.isFinite(t.stopPrice)) {
    const risk = Math.abs(t.entryPrice - t.stopPrice) * t.quantity * t.multiplier;
    if (risk > 0) return round(risk);
  }
  return t.defaultRisk && t.defaultRisk > 0 ? t.defaultRisk : null;
}

/** Result in multiples of risk, e.g. +2.4R. Null when the trade has no risk. */
export const rOf = (t: StatTrade, mode: PnlMode) =>
  t.risk && t.risk > 0 ? pnlOf(t, mode) / t.risk : null;

export function summarize(trades: StatTrade[], mode: PnlMode) {
  const pnls = trades.map((t) => pnlOf(t, mode));
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const total = grossWin - grossLoss;

  const days = dailySeries(trades, mode);
  const greenDays = days.filter((d) => d.pnl > 0).length;
  const rs = trades.map((t) => rOf(t, mode)).filter((r): r is number => r !== null);
  const totalR = rs.reduce((a, b) => a + b, 0);

  return {
    /** How many trades have a known risk, and their R totals. */
    rCount: rs.length,
    totalR: round(totalR),
    avgR: rs.length ? round(totalR / rs.length) : null,
    total,
    count: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    wins: wins.length,
    losses: losses.length,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    expectancy: trades.length ? total / trades.length : 0,
    tradingDays: days.length,
    greenDays,
    bestDay: days.reduce<(typeof days)[number] | null>(
      (best, d) => (!best || d.pnl > best.pnl ? d : best),
      null,
    ),
    worstDay: days.reduce<(typeof days)[number] | null>(
      (worst, d) => (!worst || d.pnl < worst.pnl ? d : worst),
      null,
    ),
  };
}

/** One point per trading day, sorted, with running equity. */
export function dailySeries(trades: StatTrade[], mode: PnlMode) {
  const byDay = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const key = t.day;
    const entry = byDay.get(key) ?? { pnl: 0, trades: 0 };
    entry.pnl += pnlOf(t, mode);
    entry.trades += 1;
    byDay.set(key, entry);
  }
  let equity = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => {
      equity += v.pnl;
      return { day, pnl: round(v.pnl), trades: v.trades, equity: round(equity) };
    });
}

/** Monday that starts the week containing `day` ("YYYY-MM-DD"). */
export function weekStart(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysKey(day, -((dow + 6) % 7));
}

const labelOf = (key: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1)).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
};

/** P&L per day, week (Mon–Sun) or month, sorted, with running equity and a display label. */
export function groupedSeries(trades: StatTrade[], mode: PnlMode, grouping: "day" | "week" | "month") {
  const keyOf = (day: string) =>
    grouping === "week" ? weekStart(day) : grouping === "month" ? day.slice(0, 7) : day;
  const byKey = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const key = keyOf(t.day);
    const entry = byKey.get(key) ?? { pnl: 0, trades: 0 };
    entry.pnl += pnlOf(t, mode);
    entry.trades += 1;
    byKey.set(key, entry);
  }
  let equity = 0;
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      equity += v.pnl;
      const label =
        grouping === "month"
          ? labelOf(key, { month: "short", year: "numeric" })
          : grouping === "week"
            ? `Wk ${labelOf(key, { month: "short", day: "numeric" })}`
            : labelOf(key, { month: "short", day: "numeric" });
      return { key, label, pnl: round(v.pnl), trades: v.trades, equity: round(equity) };
    });
}

export const rBins = ["< −2R", "−2 to −1R", "−1 to 0R", "0 to 1R", "1 to 2R", "2 to 3R", "> 3R"] as const;

/** How many trades fell into each R bucket (trades without risk are skipped). */
export function rDistribution(trades: StatTrade[], mode: PnlMode) {
  const counts = rBins.map((label) => ({ label, trades: 0 }));
  for (const t of trades) {
    const r = rOf(t, mode);
    if (r === null) continue;
    const i = r < -2 ? 0 : r < -1 ? 1 : r < 0 ? 2 : r < 1 ? 3 : r < 2 ? 4 : r < 3 ? 5 : 6;
    counts[i].trades += 1;
  }
  return counts;
}

function groupPnl<K extends string>(
  trades: StatTrade[],
  mode: PnlMode,
  keysOf: (t: StatTrade) => K[],
) {
  const groups = new Map<K, { pnl: number; trades: number; wins: number }>();
  for (const t of trades) {
    const pnl = pnlOf(t, mode);
    for (const key of keysOf(t)) {
      const g = groups.get(key) ?? { pnl: 0, trades: 0, wins: 0 };
      g.pnl += pnl;
      g.trades += 1;
      if (pnl > 0) g.wins += 1;
      groups.set(key, g);
    }
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    pnl: round(g.pnl),
    trades: g.trades,
    winRate: g.trades ? g.wins / g.trades : 0,
  }));
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export function byWeekday(trades: StatTrade[], mode: PnlMode) {
  const rows = groupPnl(trades, mode, (t) => {
    const d = t.openWeekday;
    return d >= 1 && d <= 5 ? [weekdays[d - 1]] : [];
  });
  return weekdays.map(
    (key) => rows.find((r) => r.key === key) ?? { key, pnl: 0, trades: 0, winRate: 0 },
  );
}

export function byHour(trades: StatTrade[], mode: PnlMode) {
  return groupPnl(trades, mode, (t) => [String(t.openHour).padStart(2, "0")])
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({ ...r, key: `${r.key}:00` }));
}

export const bySymbol = (trades: StatTrade[], mode: PnlMode) =>
  groupPnl(trades, mode, (t) => [t.symbol]).sort((a, b) => b.pnl - a.pnl);

export const byTag = (trades: StatTrade[], mode: PnlMode) =>
  groupPnl(trades, mode, (t) => t.tags).sort((a, b) => b.pnl - a.pnl);

export const byMistake = (trades: StatTrade[], mode: PnlMode) =>
  groupPnl(trades, mode, (t) => t.mistakes ?? []).sort((a, b) => a.pnl - b.pnl);

export const bySide = (trades: StatTrade[], mode: PnlMode) =>
  groupPnl(trades, mode, (t) => [t.side]);

/** Keeps a fixed bucket order and fills empty buckets, so charts don't jump around. */
function inOrder<K extends string>(rows: ReturnType<typeof groupPnl<K>>, order: readonly K[]) {
  return order.map((key) => rows.find((r) => r.key === key) ?? { key, pnl: 0, trades: 0, winRate: 0 });
}

const holdBuckets = ["< 2m", "2–5m", "5–15m", "15–30m", "30–60m", "1–2h", "2h+"] as const;

export function byHoldTime(trades: StatTrade[], mode: PnlMode) {
  const rows = groupPnl(trades, mode, (t) => {
    const mins = (t.closedAt.getTime() - t.openedAt.getTime()) / 60_000;
    const i = mins < 2 ? 0 : mins < 5 ? 1 : mins < 15 ? 2 : mins < 30 ? 3 : mins < 60 ? 4 : mins < 120 ? 5 : 6;
    return [holdBuckets[i]];
  });
  return inOrder(rows, holdBuckets);
}

const perDayBuckets = ["1 trade", "2 trades", "3 trades", "4 trades", "5+ trades"] as const;

/** P&L of trades grouped by how many trades were taken that day: does overtrading cost you? */
export function byTradesPerDay(trades: StatTrade[], mode: PnlMode) {
  const perDay = new Map<string, number>();
  for (const t of trades) perDay.set(t.day, (perDay.get(t.day) ?? 0) + 1);
  const rows = groupPnl(trades, mode, (t) => [perDayBuckets[Math.min(perDay.get(t.day)!, 5) - 1]]);
  return inOrder(rows, perDayBuckets);
}

const monthWeekBuckets = ["Days 1–7", "Days 8–14", "Days 15–21", "Days 22–31"] as const;

export function byWeekOfMonth(trades: StatTrade[], mode: PnlMode) {
  const rows = groupPnl(trades, mode, (t) => {
    const d = Number(t.day.slice(8, 10));
    return [monthWeekBuckets[d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3]];
  });
  return inOrder(rows, monthWeekBuckets);
}

const ruleBuckets = ["Followed rules", "Broke rules", "Not rated"] as const;

export function byRules(trades: StatTrade[], mode: PnlMode) {
  const rows = groupPnl(trades, mode, (t) => [
    t.followedRules === true ? ruleBuckets[0] : t.followedRules === false ? ruleBuckets[1] : ruleBuckets[2],
  ]);
  return inOrder(rows, ruleBuckets);
}

const assetLabels: Record<string, string> = { stock: "Stocks", future: "Futures", forex: "Forex", option: "Options" };

export const byAssetClass = (trades: StatTrade[], mode: PnlMode) =>
  groupPnl(trades, mode, (t) => [assetLabels[t.assetClass ?? ""] ?? "Other"]).sort((a, b) => b.pnl - a.pnl);

const priceBuckets = ["< $10", "$10–50", "$50–100", "$100–250", "$250–500", "$500–1k", "$1k–10k", "$10k+"] as const;

/** Entry price bands. Futures quote in points (e.g. NQ 20,000) so they land in the top bands. */
export function byPriceBucket(trades: StatTrade[], mode: PnlMode) {
  const rows = groupPnl(trades, mode, (t) => {
    const p = t.entryPrice ?? 0;
    const i = p < 10 ? 0 : p < 50 ? 1 : p < 100 ? 2 : p < 250 ? 3 : p < 500 ? 4 : p < 1000 ? 5 : p < 10_000 ? 6 : 7;
    return [priceBuckets[i]];
  });
  return priceBuckets.flatMap((key) => rows.filter((r) => r.key === key));
}

/** Average and total R per setup tag, counting only trades that have a risk. */
export function rByTag(trades: StatTrade[], mode: PnlMode) {
  const groups = new Map<string, { totalR: number; count: number; wins: number }>();
  for (const t of trades) {
    const r = rOf(t, mode);
    if (r === null) continue;
    for (const tag of t.tags) {
      const g = groups.get(tag) ?? { totalR: 0, count: 0, wins: 0 };
      g.totalR += r;
      g.count += 1;
      if (r > 0) g.wins += 1;
      groups.set(tag, g);
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, trades: g.count, totalR: round(g.totalR), avgR: round(g.totalR / g.count), winRate: g.wins / g.count }))
    .sort((a, b) => b.avgR - a.avgR);
}

const round = (n: number) => Math.round(n * 100) / 100;
