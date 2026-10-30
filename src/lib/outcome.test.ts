import { test } from "node:test";
import assert from "node:assert/strict";
import { byExitReason, byGrade, outcomeOf, summarize, type StatTrade } from "./stats";

const t = (p: Partial<StatTrade> & { netPnl: number }): StatTrade => ({
  id: Math.random(), symbol: "US100", side: "long", openedAt: new Date(0), closedAt: new Date(60_000),
  grossPnl: p.netPnl, tags: [], day: "2026-10-30", openHour: 9, openWeekday: 5, ...p,
});

test("break-even stops and $0 trades are scratches", () => {
  assert.equal(outcomeOf(t({ netPnl: 0 }), "net"), "breakeven");
  assert.equal(outcomeOf(t({ netPnl: -3.5, exitReason: "breakeven" }), "net"), "breakeven"); // fees on a scratch
  assert.equal(outcomeOf(t({ netPnl: 12 }), "net"), "win");
  assert.equal(outcomeOf(t({ netPnl: -12, exitReason: "stop" }), "net"), "loss");
});

test("scratches stay out of the win rate but in the P&L", () => {
  const s = summarize([t({ netPnl: 500 }), t({ netPnl: -250 }), t({ netPnl: -3.5, exitReason: "breakeven" }), t({ netPnl: 0 })], "net");
  assert.deepEqual([s.wins, s.losses, s.breakevens], [1, 1, 2]);
  assert.equal(s.winRate, 0.5);
  assert.equal(s.total, 246.5);
  assert.equal(s.avgLoss, 250); // the scratch's fees don't count as a loss
});

test("grade and exit breakdowns keep their order", () => {
  const trades = [t({ netPnl: 0, grade: "A-", exitReason: "breakeven" }), t({ netPnl: 300, grade: "A+", exitReason: "target" }), t({ netPnl: -100 })];
  assert.deepEqual(byGrade(trades, "net").map((r) => r.key), ["A+", "A-", "Not graded"]);
  assert.deepEqual(byExitReason(trades, "net").map((r) => r.key), ["Target hit", "Break-even stop", "Not set"]);
  assert.equal(byGrade(trades, "net").find((r) => r.key === "A-")!.winRate, null); // only a scratch: no decided trades
});
