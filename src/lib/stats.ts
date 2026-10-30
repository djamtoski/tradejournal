/** Pure metric helpers. Inputs are closed trades; no DB access here. */

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
};

export type PnlMode = "net" | "gross";

export const pnlOf = (t: StatTrade, mode: PnlMode) =>
  mode === "net" ? t.netPnl : t.grossPnl;

export function summarize(trades: StatTrade[], mode: PnlMode) {
  const pnls = trades.map((t) => pnlOf(t, mode));
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const total = grossWin - grossLoss;

  const days = dailySeries(trades, mode);
  const greenDays = days.filter((d) => d.pnl > 0).length;

  return {
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

const round = (n: number) => Math.round(n * 100) / 100;
