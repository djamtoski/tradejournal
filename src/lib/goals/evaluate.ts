/**
 * Goals and streaks, as pure functions over trades so they can be tested and
 * reused by the Goals page, Daily, Calendar and the dashboard. Everything here
 * uses net P&L: limits and targets are about the money that actually lands.
 */
import type { goals as goalsTable } from "@/db/schema";
import { formatMoney } from "@/lib/format";
import { weekStart } from "@/lib/stats";
import { addDaysKey } from "@/lib/tz";

// Types only from the schema, so client components can import this file.
export type GoalKind = (typeof goalsTable.$inferSelect)["kind"];
export type GoalPeriod = (typeof goalsTable.$inferSelect)["period"];

export type Goal = {
  id: number;
  kind: GoalKind;
  period: GoalPeriod;
  value: number;
  accountId: number | null;
  active: boolean;
};

export type GoalTrade = {
  day: string;
  openedAt: Date;
  closedAt: Date;
  netPnl: number;
  accountId: number;
  followedRules?: boolean | null;
};

export const goalKindOptions: { id: GoalKind; label: string; unit: "$" | "count" }[] = [
  { id: "max_trades_per_day", label: "Max trades a day", unit: "count" },
  { id: "max_daily_loss", label: "Max daily loss", unit: "$" },
  { id: "max_consecutive_losses", label: "Max losses in a row", unit: "count" },
  { id: "profit_target", label: "Profit target", unit: "$" },
];

export const goalPeriodOptions: { id: GoalPeriod; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export const isLimit = (g: Pick<Goal, "kind">) => g.kind !== "profit_target";

const periodWord = { day: "day", week: "week", month: "month" } as const;

export function goalLabel(g: Pick<Goal, "kind" | "period" | "value">) {
  switch (g.kind) {
    case "max_trades_per_day":
      return `Max ${g.value} ${g.value === 1 ? "trade" : "trades"} a day`;
    case "max_daily_loss":
      return `Max daily loss ${formatMoney(g.value)}`;
    case "max_consecutive_losses":
      return `Stop after ${g.value} ${g.value === 1 ? "loss" : "losses"} in a row`;
    case "profit_target":
      return `${formatMoney(g.value)} a ${periodWord[g.period]}`;
  }
}

export type GoalInput = { kind: string; period: string; value: number; accountId: number | null };

/** Checks a goal from the form. Counts must be whole numbers, dollar amounts positive. */
export function validateGoal(input: GoalInput):
  | { ok: true; goal: Omit<Goal, "id" | "active"> }
  | { ok: false; error: string } {
  const kind = goalKindOptions.find((o) => o.id === input.kind)?.id;
  if (!kind) return { ok: false, error: "Choose a goal type." };
  const period = kind === "profit_target" ? goalPeriodOptions.find((o) => o.id === input.period)?.id : "day";
  if (!period) return { ok: false, error: "Choose day, week or month." };
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "Enter a number above zero." };
  const unit = goalKindOptions.find((o) => o.id === kind)!.unit;
  if (unit === "count" && !Number.isInteger(value)) return { ok: false, error: "Enter a whole number." };
  return { ok: true, goal: { kind, period, value: unit === "$" ? Math.round(value * 100) / 100 : value, accountId: input.accountId } };
}

const forGoal = <T extends GoalTrade>(trades: T[], g: Pick<Goal, "accountId">) =>
  g.accountId == null ? trades : trades.filter((t) => t.accountId === g.accountId);

const byOpen = <T extends GoalTrade>(trades: T[]) => [...trades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
const byClose = <T extends GoalTrade>(trades: T[]) => [...trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());

export type Breach = { goal: Goal; at: Date; text: string };

/** When (if at all) one day's trades broke a limit goal. */
function checkLimit(trades: GoalTrade[], g: Goal): Breach | null {
  switch (g.kind) {
    case "max_trades_per_day": {
      const sorted = byOpen(trades);
      if (sorted.length <= g.value) return null;
      return { goal: g, at: sorted[g.value].openedAt, text: `Took ${sorted.length} trades, over the limit of ${g.value}` };
    }
    case "max_daily_loss": {
      let pnl = 0;
      for (const t of byClose(trades)) {
        pnl += t.netPnl;
        if (pnl <= -g.value) return { goal: g, at: t.closedAt, text: `Hit the ${formatMoney(g.value)} daily loss limit` };
      }
      return null;
    }
    case "max_consecutive_losses": {
      // The breach is trading on after the streak, not the losing streak itself.
      let run = 0;
      for (const t of byOpen(trades)) {
        if (run >= g.value) {
          return { goal: g, at: t.openedAt, text: `Kept trading after ${g.value} ${g.value === 1 ? "loss" : "losses"} in a row` };
        }
        run = t.netPnl < 0 ? run + 1 : 0;
      }
      return null;
    }
    case "profit_target":
      return null;
  }
}

/** Limit breaches for one day's trades, earliest first. Each goal only looks at its own account. */
export function evaluateDay(trades: GoalTrade[], goals: Goal[]): Breach[] {
  return goals
    .filter((g) => g.active && isLimit(g))
    .map((g) => checkLimit(forGoal(trades, g), g))
    .filter((b): b is Breach => b !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

const groupByDay = <T extends GoalTrade>(trades: T[]) => {
  const days = new Map<string, T[]>();
  for (const t of trades) days.set(t.day, [...(days.get(t.day) ?? []), t]);
  return days;
};

/** Breaches for every trading day that has any. */
export function breachesByDay(trades: GoalTrade[], goals: Goal[]) {
  const out = new Map<string, Breach[]>();
  if (!goals.some((g) => g.active && isLimit(g))) return out;
  for (const [day, list] of groupByDay(trades)) {
    const breaches = evaluateDay(list, goals);
    if (breaches.length) out.set(day, breaches);
  }
  return out;
}

export function periodStart(day: string, period: GoalPeriod) {
  return period === "week" ? weekStart(day) : period === "month" ? `${day.slice(0, 7)}-01` : day;
}

/** Exclusive end key of the period that starts on `start`. */
export function periodEnd(start: string, period: GoalPeriod) {
  if (period === "day") return addDaysKey(start, 1);
  if (period === "week") return addDaysKey(start, 7);
  const [y, m] = start.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Progress toward a profit target in the period containing `today`, plus how often past periods hit it. */
export function targetProgress(trades: GoalTrade[], g: Goal, today: string) {
  const start = periodStart(today, g.period);
  const totals = new Map<string, number>();
  for (const t of forGoal(trades, g)) {
    const key = periodStart(t.day, g.period);
    totals.set(key, (totals.get(key) ?? 0) + t.netPnl);
  }
  const pnl = Math.round((totals.get(start) ?? 0) * 100) / 100;
  const past = [...totals.entries()].filter(([key]) => key < start);
  return {
    start,
    end: periodEnd(start, g.period),
    pnl,
    pct: Math.max(0, Math.min(1, pnl / g.value)),
    hit: pnl >= g.value,
    pastPeriods: past.length,
    pastHits: past.filter(([, v]) => v >= g.value).length,
  };
}

export type JournalDay = { content: string; followedRules: boolean | null };

export type DayStatus = {
  day: string;
  pnl: number;
  trades: number;
  breaches: Breach[];
  journaled: boolean;
  /** Journal rating if set, otherwise from the day's rated trades; null when nothing is rated. */
  followedRules: boolean | null;
};

/** One row per trading day, oldest first. */
export function dayStatuses(trades: GoalTrade[], goals: Goal[], journal: Map<string, JournalDay>): DayStatus[] {
  return [...groupByDay(trades)]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => {
      const entry = journal.get(day);
      const rated = list.map((t) => t.followedRules).filter((r): r is boolean => typeof r === "boolean");
      const fromTrades = rated.length ? rated.every(Boolean) : null;
      return {
        day,
        pnl: Math.round(list.reduce((s, t) => s + t.netPnl, 0) * 100) / 100,
        trades: list.length,
        breaches: evaluateDay(list, goals),
        journaled: !!entry?.content.trim(),
        followedRules: entry?.followedRules ?? fromTrades,
      };
    });
}

export type Streak = { current: number; longest: number };

/** Current = the run ending at the last item; longest = the best run anywhere. */
export function streakOf(flags: boolean[]): Streak {
  let run = 0;
  let longest = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { current: run, longest };
}

export const streakKinds = [
  { id: "withinLimits", label: "Within limits", unit: "days" },
  { id: "followedRules", label: "Followed rules", unit: "days" },
  { id: "journaled", label: "Journaled", unit: "days" },
  { id: "greenDays", label: "Green days", unit: "days" },
  { id: "greenWeeks", label: "Green weeks", unit: "weeks" },
] as const;
export type StreakId = (typeof streakKinds)[number]["id"];

/** Streaks over trading days; days without trades neither extend nor break them. */
export function streaks(days: DayStatus[]): Record<StreakId, Streak> {
  const weeks = new Map<string, number>();
  for (const d of days) weeks.set(weekStart(d.day), (weeks.get(weekStart(d.day)) ?? 0) + d.pnl);
  return {
    withinLimits: streakOf(days.map((d) => d.breaches.length === 0)),
    followedRules: streakOf(days.map((d) => d.followedRules === true)),
    journaled: streakOf(days.map((d) => d.journaled)),
    greenDays: streakOf(days.map((d) => d.pnl > 0)),
    greenWeeks: streakOf([...weeks].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, pnl]) => pnl > 0)),
  };
}
