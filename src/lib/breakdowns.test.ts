import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byAssetClass,
  byHoldTime,
  byPriceBucket,
  byRules,
  byTradesPerDay,
  byWeekOfMonth,
  rByTag,
  type StatTrade,
} from "./stats";

const at = (min: number) => new Date(Date.UTC(2026, 9, 5, 14, 0) + min * 60_000);

const t = (p: Partial<StatTrade> & { netPnl: number }): StatTrade => ({
  id: Math.random(), symbol: "NQ", side: "long", openedAt: at(0), closedAt: at(10),
  grossPnl: p.netPnl, tags: [], day: "2026-10-05", openHour: 10, openWeekday: 1, ...p,
});

const pick = <T extends { key: string }>(rows: T[], key: string) => rows.find((r) => r.key === key);

test("hold time buckets keep their order and include empty ones", () => {
  const rows = byHoldTime([t({ netPnl: 10, closedAt: at(1) }), t({ netPnl: -5, closedAt: at(45) }), t({ netPnl: 20, closedAt: at(200) })], "net");
  assert.deepEqual(rows.map((r) => r.key), ["< 2m", "2–5m", "5–15m", "15–30m", "30–60m", "1–2h", "2h+"]);
  assert.deepEqual(rows.map((r) => r.trades), [1, 0, 0, 0, 1, 0, 1]);
});

test("trades per day groups each trade by its day's trade count", () => {
  const busy = Array.from({ length: 6 }, () => t({ netPnl: -10, day: "2026-10-06" }));
  const rows = byTradesPerDay([t({ netPnl: 100, day: "2026-10-05" }), ...busy], "net");
  assert.equal(pick(rows, "1 trade")?.pnl, 100);
  assert.equal(pick(rows, "5+ trades")?.trades, 6);
  assert.equal(pick(rows, "5+ trades")?.pnl, -60);
});

test("week of month uses the calendar day", () => {
  const rows = byWeekOfMonth([t({ netPnl: 1, day: "2026-10-07" }), t({ netPnl: 2, day: "2026-10-08" }), t({ netPnl: 3, day: "2026-10-31" })], "net");
  assert.deepEqual(rows.map((r) => r.pnl), [1, 2, 0, 3]);
});

test("rule rating splits followed, broken and unrated", () => {
  const rows = byRules([t({ netPnl: 50, followedRules: true }), t({ netPnl: -80, followedRules: false }), t({ netPnl: 5 })], "net");
  assert.deepEqual(rows.map((r) => [r.key, r.pnl]), [["Followed rules", 50], ["Broke rules", -80], ["Not rated", 5]]);
});

test("asset class and price buckets", () => {
  const trades = [
    t({ netPnl: 300, assetClass: "future", entryPrice: 20000 }),
    t({ netPnl: -40, assetClass: "stock", entryPrice: 228 }),
    t({ netPnl: 10, assetClass: "stock", entryPrice: 8 }),
  ];
  assert.deepEqual(byAssetClass(trades, "net").map((r) => [r.key, r.pnl]), [["Futures", 300], ["Stocks", -30]]);
  assert.deepEqual(byPriceBucket(trades, "net").map((r) => r.key), ["< $10", "$100–250", "$10k+"]);
});

test("R by setup averages only trades with a risk", () => {
  const rows = rByTag([
    t({ netPnl: 1000, risk: 500, tags: ["ORB"] }),
    t({ netPnl: -500, risk: 500, tags: ["ORB"] }),
    t({ netPnl: 900, tags: ["ORB"] }),
    t({ netPnl: 600, risk: 200, tags: ["VWAP"] }),
  ], "net");
  assert.deepEqual(rows.map((r) => [r.key, r.trades, r.avgR, r.totalR]), [["VWAP", 1, 3, 3], ["ORB", 2, 0.5, 1]]);
});
