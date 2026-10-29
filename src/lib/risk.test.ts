import { test } from "node:test";
import assert from "node:assert/strict";
import { rDistribution, riskOf, rOf, summarize, type StatTrade } from "./stats";

const t = (netPnl: number, risk: number | null, extra: Partial<StatTrade> = {}): StatTrade => ({
  id: Math.random(), symbol: "NQ", side: "long", openedAt: new Date(), closedAt: new Date(),
  grossPnl: netPnl + 4, netPnl, tags: [], day: "2026-10-05", openHour: 10, openWeekday: 1, risk, ...extra,
});

test("risk comes from the stop when one is set", () => {
  // NQ long 2 @ 20000, stop 19990: 10 points × 2 × $20 = $400.
  assert.equal(riskOf({ entryPrice: 20000, stopPrice: 19990, quantity: 2, multiplier: 20, defaultRisk: 500 }), 400);
  // Short: stop above entry gives the same positive risk.
  assert.equal(riskOf({ entryPrice: 230, stopPrice: 231.5, quantity: 100, multiplier: 1, defaultRisk: null }), 150);
});

test("without a stop, the account default is used; with neither, there is no risk", () => {
  assert.equal(riskOf({ entryPrice: 100, stopPrice: null, quantity: 10, multiplier: 1, defaultRisk: 250 }), 250);
  assert.equal(riskOf({ entryPrice: 100, stopPrice: null, quantity: 10, multiplier: 1, defaultRisk: null }), null);
  // A stop at the entry price is zero risk, so fall back to the default.
  assert.equal(riskOf({ entryPrice: 100, stopPrice: 100, quantity: 10, multiplier: 1, defaultRisk: 200 }), 200);
});

test("R is P&L divided by risk, in net or gross", () => {
  assert.equal(rOf(t(800, 400), "net"), 2);
  assert.equal(rOf(t(-200, 400), "net"), -0.5);
  assert.equal(rOf(t(796, 400), "gross"), 2);
  assert.equal(rOf(t(500, null), "net"), null);
});

test("summary R stats ignore trades without risk", () => {
  const s = summarize([t(800, 400), t(-400, 400), t(1000, null), t(300, 200)], "net");
  assert.equal(s.rCount, 3);
  assert.equal(s.totalR, 2.5); // 2 − 1 + 1.5
  assert.equal(s.avgR, 0.83);
  assert.equal(summarize([t(100, null)], "net").avgR, null);
});

test("R distribution buckets trades", () => {
  const d = rDistribution([t(-1200, 400), t(-200, 400), t(200, 400), t(400, 400), t(1600, 400), t(50, null)], "net");
  assert.deepEqual(d.map((b) => b.trades), [1, 0, 1, 1, 1, 0, 1]);
});
