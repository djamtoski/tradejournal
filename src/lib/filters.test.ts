import { test } from "node:test";
import assert from "node:assert/strict";
import { applyUrlOverrides, defaultFilters, parseFilterCookie, serializeFilters } from "./filters";
import { groupedSeries, weekStart, type StatTrade } from "./stats";

test("filter cookie round-trips", () => {
  const f = { ...defaultFilters, range: "ytd" as const, mode: "gross" as const, accountIds: [2, 5], assetClasses: ["future" as const], grouping: "week" as const };
  assert.deepEqual(parseFilterCookie(serializeFilters(f)), f);
});

test("malformed cookies fall back field by field", () => {
  assert.deepEqual(parseFilterCookie(undefined), defaultFilters);
  assert.deepEqual(parseFilterCookie("not json"), defaultFilters);
  assert.deepEqual(parseFilterCookie("[1,2]"), defaultFilters);
  const f = parseFilterCookie(JSON.stringify({ range: "10y", mode: "gross", accountIds: [1, "x", -3, 1.5, 4, 4], assetClasses: ["future", "crypto"], grouping: "hour" }));
  assert.equal(f.range, "90d");
  assert.equal(f.mode, "gross");
  assert.deepEqual(f.accountIds, [1, 4]);
  assert.deepEqual(f.assetClasses, ["future"]);
  assert.equal(f.grouping, "day");
});

test("URL params override range and mode only", () => {
  const f = applyUrlOverrides({ ...defaultFilters, accountIds: [3] }, { range: "all", mode: "gross", accountIds: "9" });
  assert.equal(f.range, "all");
  assert.equal(f.mode, "gross");
  assert.deepEqual(f.accountIds, [3]);
  assert.equal(applyUrlOverrides(defaultFilters, { range: "bogus" }).range, "90d");
});

const trade = (day: string, netPnl: number, id = Math.random()): StatTrade => ({
  id, symbol: "NQ", side: "long", openedAt: new Date(), closedAt: new Date(),
  grossPnl: netPnl + 5, netPnl, tags: [], day, openHour: 10, openWeekday: 1,
});

test("weeks start on Monday", () => {
  assert.equal(weekStart("2026-10-05"), "2026-10-05"); // Monday
  assert.equal(weekStart("2026-10-11"), "2026-10-05"); // Sunday
  assert.equal(weekStart("2026-11-01"), "2026-10-26"); // crosses month
});

test("P&L groups by day, week and month with running equity", () => {
  const trades = [trade("2026-09-30", 100), trade("2026-10-01", -40), trade("2026-10-01", 10), trade("2026-10-06", 50)];
  const days = groupedSeries(trades, "net", "day");
  assert.deepEqual(days.map((d) => [d.key, d.pnl, d.trades]), [["2026-09-30", 100, 1], ["2026-10-01", -30, 2], ["2026-10-06", 50, 1]]);
  assert.deepEqual(days.map((d) => d.equity), [100, 70, 120]);
  assert.equal(days[0].label, "Sep 30");

  const weeks = groupedSeries(trades, "net", "week");
  assert.deepEqual(weeks.map((w) => [w.key, w.pnl]), [["2026-09-28", 70], ["2026-10-05", 50]]);
  assert.equal(weeks[0].label, "Wk Sep 28");

  const months = groupedSeries(trades, "gross", "month");
  assert.deepEqual(months.map((m) => [m.key, m.pnl, m.label]), [["2026-09", 105, "Sep 2026"], ["2026-10", 35, "Oct 2026"]]);
});
