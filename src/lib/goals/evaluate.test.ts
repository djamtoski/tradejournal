import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breachesByDay,
  dayStatuses,
  evaluateDay,
  periodEnd,
  streakOf,
  streaks,
  targetProgress,
  validateGoal,
  type Goal,
  type GoalTrade,
} from "./evaluate";

const at = (day: string, min: number) => new Date(Date.parse(`${day}T14:00:00Z`) + min * 60_000);

/** A trade opened `min` minutes into the session and closed five minutes later. */
const t = (netPnl: number, min = 0, p: Partial<GoalTrade> = {}): GoalTrade => {
  const day = p.day ?? "2026-10-05";
  return { day, openedAt: at(day, min), closedAt: at(day, min + 5), netPnl, accountId: 1, ...p };
};

let nextId = 1;
const goal = (kind: Goal["kind"], value: number, p: Partial<Goal> = {}): Goal => ({
  id: nextId++, kind, value, period: "day", accountId: null, active: true, ...p,
});

test("max trades breaches on the first trade over the limit", () => {
  const trades = [t(10, 30), t(-5, 0), t(20, 60), t(5, 90)];
  const [b] = evaluateDay(trades, [goal("max_trades_per_day", 3)]);
  assert.equal(b.at.getTime(), at("2026-10-05", 90).getTime());
  assert.deepEqual(evaluateDay(trades, [goal("max_trades_per_day", 4)]), []);
});

test("daily loss breaches when the running P&L reaches the limit", () => {
  const trades = [t(300, 0), t(-800, 10), t(-500, 20), t(900, 30)];
  const [b] = evaluateDay(trades, [goal("max_daily_loss", 1000)]);
  assert.equal(b.at.getTime(), at("2026-10-05", 25).getTime()); // close of the third trade: -1000
  assert.deepEqual(evaluateDay(trades, [goal("max_daily_loss", 1001)]), []);
});

test("losses in a row breach only when trading continues after the streak", () => {
  const stopped = [t(-10, 0), t(-10, 10)];
  assert.deepEqual(evaluateDay(stopped, [goal("max_consecutive_losses", 2)]), []);
  const kept = [t(-10, 0), t(5, 10), t(-10, 20), t(-10, 30), t(40, 40)];
  const [b] = evaluateDay(kept, [goal("max_consecutive_losses", 2)]);
  assert.equal(b.at.getTime(), at("2026-10-05", 40).getTime());
});

test("paused goals, targets and other accounts are ignored", () => {
  const trades = [t(-10, 0, { accountId: 2 }), t(-10, 10, { accountId: 2 }), t(-10, 20, { accountId: 2 })];
  const goals = [
    goal("max_trades_per_day", 1, { active: false }),
    goal("max_trades_per_day", 1, { accountId: 1 }),
    goal("profit_target", 100),
  ];
  assert.deepEqual(evaluateDay(trades, goals), []);
  assert.equal(evaluateDay(trades, [goal("max_trades_per_day", 1, { accountId: 2 })]).length, 1);
});

test("breaches are grouped by day", () => {
  const trades = [t(1, 0), t(1, 10), t(1, 0, { day: "2026-10-06" })];
  const map = breachesByDay(trades, [goal("max_trades_per_day", 1)]);
  assert.deepEqual([...map.keys()], ["2026-10-05"]);
});

test("profit target progress for the current week and past hit rate", () => {
  const g = goal("profit_target", 1000, { period: "week" });
  const trades = [
    t(600, 0, { day: "2026-09-28" }), t(700, 0, { day: "2026-10-01" }), // week of Sep 28: 1300, hit
    t(400, 0, { day: "2026-10-05" }), t(-100, 0, { day: "2026-10-07" }), // this week: 300
    t(200, 0, { day: "2026-09-22" }), // week of Sep 21: miss
  ];
  const p = targetProgress(trades, g, "2026-10-08");
  assert.equal(p.start, "2026-10-05");
  assert.equal(p.end, "2026-10-12");
  assert.equal(p.pnl, 300);
  assert.equal(p.pct, 0.3);
  assert.equal(p.hit, false);
  assert.deepEqual([p.pastPeriods, p.pastHits], [2, 1]);
});

test("month periods roll over the year", () => {
  assert.equal(periodEnd("2026-12-01", "month"), "2027-01-01");
  assert.equal(periodEnd("2026-02-01", "month"), "2026-03-01");
});

test("streakOf counts the trailing run and the best run", () => {
  assert.deepEqual(streakOf([true, true, true, false, true, true]), { current: 2, longest: 3 });
  assert.deepEqual(streakOf([true, false]), { current: 0, longest: 1 });
  assert.deepEqual(streakOf([]), { current: 0, longest: 0 });
});

test("day statuses and streaks", () => {
  const trades = [
    t(100, 0, { day: "2026-10-01", followedRules: true }),
    t(-50, 0, { day: "2026-10-02", followedRules: false }),
    t(80, 0, { day: "2026-10-05", followedRules: true }),
    t(20, 10, { day: "2026-10-05" }),
    t(30, 20, { day: "2026-10-06" }),
  ];
  const journal = new Map([
    ["2026-10-02", { content: "Chased.", followedRules: null }],
    ["2026-10-05", { content: "Clean.", followedRules: null }],
    ["2026-10-06", { content: "  ", followedRules: true }],
  ]);
  const days = dayStatuses(trades, [goal("max_trades_per_day", 1)], journal);
  assert.deepEqual(days.map((d) => d.day), ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"]);
  assert.deepEqual(days.map((d) => d.followedRules), [true, false, true, true]);
  assert.deepEqual(days.map((d) => d.journaled), [false, true, true, false]);
  assert.deepEqual(days.map((d) => d.breaches.length), [0, 0, 1, 0]);

  const s = streaks(days);
  assert.deepEqual(s.greenDays, { current: 2, longest: 2 });
  assert.deepEqual(s.followedRules, { current: 2, longest: 2 });
  assert.deepEqual(s.withinLimits, { current: 1, longest: 2 });
  assert.deepEqual(s.journaled, { current: 0, longest: 2 });
  assert.deepEqual(s.greenWeeks, { current: 2, longest: 2 }); // +50, then +130
});

test("goal validation", () => {
  assert.equal(validateGoal({ kind: "max_trades_per_day", period: "week", value: 2.5, accountId: null }).ok, false);
  assert.equal(validateGoal({ kind: "max_daily_loss", period: "day", value: 0, accountId: null }).ok, false);
  assert.equal(validateGoal({ kind: "nope", period: "day", value: 1, accountId: null }).ok, false);
  const limit = validateGoal({ kind: "max_trades_per_day", period: "month", value: 4, accountId: 3 });
  assert.deepEqual(limit, { ok: true, goal: { kind: "max_trades_per_day", period: "day", value: 4, accountId: 3 } });
  const target = validateGoal({ kind: "profit_target", period: "week", value: 1234.567, accountId: null });
  assert.deepEqual(target, { ok: true, goal: { kind: "profit_target", period: "week", value: 1234.57, accountId: null } });
});
