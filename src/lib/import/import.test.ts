import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrades, type Fill } from "./build-trades";
import { fingerprints, guessMapping, parseDateTime, parseRows, parseSide } from "./parse";

let nextId = 1;
const fill = (action: "buy" | "sell", quantity: number, price: number, minute: number, fees = 0): Fill => ({
  id: nextId++, action, quantity, price, fees, executedAt: minute * 60_000,
});

test("simple long round trip", () => {
  const [t, ...rest] = buildTrades([fill("buy", 100, 10, 0, 1), fill("sell", 100, 11, 5, 1)], 1);
  assert.equal(rest.length, 0);
  assert.equal(t.side, "long");
  assert.equal(t.grossPnl, 100);
  assert.equal(t.netPnl, 98);
  assert.equal(t.closedAt, 5 * 60_000);
});

test("scale in and partial exits average correctly", () => {
  const [t] = buildTrades([
    fill("buy", 1, 100, 0), fill("buy", 1, 102, 1), fill("sell", 1, 104, 2), fill("sell", 1, 106, 3),
  ], 20);
  assert.equal(t.quantity, 2);
  assert.equal(t.entryPrice, 101);
  assert.equal(t.exitPrice, 105);
  assert.equal(t.grossPnl, (4 + 4) * 20);
});

test("short trade P&L is positive when price falls", () => {
  const [t] = buildTrades([fill("sell", 50, 20, 0), fill("buy", 50, 19, 1)], 1);
  assert.equal(t.side, "short");
  assert.equal(t.grossPnl, 50);
});

test("a flip splits into two trades and fees are prorated", () => {
  const trades = buildTrades([fill("buy", 2, 10, 0, 2), fill("sell", 3, 12, 1, 3), fill("buy", 1, 11, 2, 1)], 1);
  assert.equal(trades.length, 2);
  assert.equal(trades[0].grossPnl, 4);
  assert.equal(trades[0].fees, 4); // 2 + 2/3 of 3
  assert.equal(trades[1].side, "short");
  assert.equal(trades[1].grossPnl, 1);
  assert.equal(trades[1].fees, 2); // 1/3 of 3 + 1
});

test("open position stays open", () => {
  const trades = buildTrades([fill("buy", 1, 10, 0), fill("sell", 1, 11, 1), fill("buy", 5, 12, 2)], 1);
  assert.equal(trades.length, 2);
  assert.equal(trades[1].closedAt, null);
  assert.equal(trades[1].exitPrice, null);
});

test("date formats", () => {
  const iso = parseDateTime("2026-10-05 09:31:02");
  assert.equal(iso, new Date(2026, 9, 5, 9, 31, 2).getTime());
  assert.equal(parseDateTime("10/05/2026 1:05:00 PM"), new Date(2026, 9, 5, 13, 5).getTime());
  assert.equal(parseDateTime("05.10.2026 09:31"), new Date(2026, 9, 5, 9, 31).getTime());
  assert.equal(parseDateTime("09:31:02"), null);
  assert.equal(parseDateTime("2026-02-30"), null);
});

test("sides", () => {
  assert.equal(parseSide("BOT"), "buy");
  assert.equal(parseSide("Sell Short"), "sell");
  assert.equal(parseSide("Buy to Cover"), "buy");
  assert.equal(parseSide("??"), null);
});

test("mapping guess splits date and time columns", () => {
  const headers = ["Trade Date", "Exec Time", "Symbol", "B/S", "Qty", "Price", "Commission"];
  const m = guessMapping(headers, { "Trade Date": "10/05/2026", "Exec Time": "09:31:02" });
  assert.equal(m.date, "Trade Date");
  assert.equal(m.time, "Exec Time");
  assert.equal(m.side, "B/S");
  assert.equal(m.fees, "Commission");
});

test("rows parse with signed quantity and errors are reported", () => {
  const mapping = guessMapping(["Time", "Symbol", "Qty", "Price"]);
  const { executions, errors } = parseRows(
    [
      { Time: "2026-10-05 09:30:00", Symbol: "aapl", Qty: "100", Price: "$228.10" },
      { Time: "2026-10-05 09:35:00", Symbol: "aapl", Qty: "-100", Price: "229" },
      { Time: "bad", Symbol: "aapl", Qty: "1", Price: "1" },
    ],
    { ...mapping, datetime: "Time" },
    { assetClass: "stock", multiplier: 1 },
  );
  assert.equal(executions.length, 2);
  assert.equal(executions[0].symbol, "AAPL");
  assert.equal(executions[1].action, "sell");
  assert.equal(executions[1].quantity, 100);
  assert.deepEqual(errors.map((e) => e.row), [4]);
});

test("identical fills get distinct, stable fingerprints", () => {
  const e = { symbol: "NQ", assetClass: "future" as const, action: "buy" as const, quantity: 1, price: 1, fees: 0, multiplier: 20, executedAt: 0 };
  const a = fingerprints([e, e]);
  assert.notEqual(a[0], a[1]);
  assert.deepEqual(fingerprints([e, e]), a);
});
