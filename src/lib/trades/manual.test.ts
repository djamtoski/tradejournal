import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFuture } from "../instruments";
import { parseLocalDateTime, toLocalDateTime, validateManualTrade, type ManualTradeInput } from "./manual";

const NY = "America/New_York";

const base: ManualTradeInput = {
  accountId: 1,
  symbol: "nq",
  assetClass: "future",
  side: "long",
  quantity: 2,
  multiplier: 20,
  entryPrice: 20000,
  exitPrice: 20010.25,
  openedAt: "2026-10-05T09:31",
  closedAt: "2026-10-05T09:47",
  fees: 9,
};

test("futures roots resolve from contract codes", () => {
  assert.equal(resolveFuture("NQZ6")?.multiplier, 20);
  assert.equal(resolveFuture("nqz26")?.root, "NQ");
  assert.equal(resolveFuture("MNQH7")?.root, "MNQ");
  assert.equal(resolveFuture("MNQ")?.multiplier, 2);
  assert.equal(resolveFuture("/ES")?.root, "ES");
  assert.equal(resolveFuture("ES 12-26")?.root, "ES");
  assert.equal(resolveFuture("MES")?.multiplier, 5);
  assert.equal(resolveFuture("AAPL"), null);
  assert.equal(resolveFuture("NQX"), null);
});

test("a closed long futures trade computes P&L with the multiplier", () => {
  const res = validateManualTrade(base, NY);
  assert.ok(res.ok);
  assert.equal(res.values.symbol, "NQ");
  assert.equal(res.values.grossPnl, 410); // 10.25 points × 2 × $20
  assert.equal(res.values.netPnl, 401);
  assert.equal(res.values.openedAt.toISOString(), "2026-10-05T13:31:00.000Z"); // 09:31 EDT
});

test("a short profits when price falls", () => {
  const res = validateManualTrade({ ...base, side: "short", symbol: "AAPL", assetClass: "stock", multiplier: 1, quantity: 100, entryPrice: 230, exitPrice: 228.5, fees: 1 }, NY);
  assert.ok(res.ok);
  assert.equal(res.values.grossPnl, 150);
  assert.equal(res.values.netPnl, 149);
});

test("leaving exit and close empty saves an open position", () => {
  const res = validateManualTrade({ ...base, exitPrice: null, closedAt: null }, NY);
  assert.ok(res.ok);
  assert.equal(res.values.closedAt, null);
  assert.equal(res.values.exitPrice, null);
  assert.equal(res.values.netPnl, 0);
});

test("inconsistent or invalid input is rejected field by field", () => {
  const r1 = validateManualTrade({ ...base, closedAt: null }, NY);
  assert.ok(!r1.ok && r1.errors.closedAt);
  const r2 = validateManualTrade({ ...base, exitPrice: null }, NY);
  assert.ok(!r2.ok && r2.errors.exitPrice);
  const r3 = validateManualTrade({ ...base, closedAt: "2026-10-05T09:00" }, NY);
  assert.ok(!r3.ok && r3.errors.closedAt?.includes("before"));
  const r4 = validateManualTrade({ ...base, quantity: 0, symbol: " ", fees: -1, openedAt: "2026-02-30T10:00" }, NY);
  assert.ok(!r4.ok);
  assert.deepEqual(Object.keys(r4.errors).sort(), ["fees", "openedAt", "quantity", "symbol"]);
});

test("datetime-local values round-trip through the trading timezone", () => {
  const d = parseLocalDateTime("2026-12-07T09:30", NY)!;
  assert.equal(d.toISOString(), "2026-12-07T14:30:00.000Z"); // EST
  assert.equal(toLocalDateTime(d, NY), "2026-12-07T09:30");
  assert.equal(parseLocalDateTime("2026-12-07 09:30", NY), null);
  assert.equal(parseLocalDateTime("2026-12-07T24:00", NY), null);
});
