import { test } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { detectPreset } from "./presets";
import { guessMapping } from "./parse";

const NY = "America/New_York";
const csv = (text: string) =>
  Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });

// Synthetic rows in the layout of Tradovate's Orders export (no real account data).
const orders = csv(`
orderId,Account,Order ID,B/S,Contract,Product,Product Description,avgPrice,filledQty,Fill Time,lastCommandId,Status,_priceFormat,_priceFormatType,_tickSize,spreadDefinitionId,Version ID,Timestamp,Date,Quantity,Text,Type,Limit Price,Stop Price,decimalLimit,decimalStop,Filled Qty,Avg Fill Price,decimalFillAvg
1001,DEMO123,1001, Buy,NQZ6,NQ,E-Mini NASDAQ 100,21050.25,2,10/28/2026 09:36:12,1,Filled,-2,0,0.25,,1,10/28/2026 09:36:11,10/28/26,2,,Market,,,,,2,"21,050.25",21050.25
1002,DEMO123,1002, Sell,NQZ6,NQ,E-Mini NASDAQ 100,,0,,2,Canceled,-2,0,0.25,,2,10/28/2026 09:40:00,10/28/26,2,,Limit,21080,,21080,,0,,
1003,DEMO123,1003, Sell,NQZ6,NQ,E-Mini NASDAQ 100,21040.5,2,10/28/2026 09:51:03,3,Filled,-2,0,0.25,,3,10/28/2026 09:51:03,10/28/26,2,,Stop,,21040.5,,21040.5,2,"21,040.50",21040.5
1004,DEMO123,1004, Sell,MESZ6,MES,Micro E-mini S&P,5801.25,1,10/28/2026 10:02:00,4,Canceled,-2,0,0.25,,4,10/28/2026 10:01:00,10/28/26,3,,Limit,5801.25,,5801.25,,1,"5,801.25",5801.25
`);

// Synthetic rows in the layout of Tradovate's Performance export.
const performance = csv(`
symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
MNQZ6,-2,0,0.25,5001,5002,3,21000.00,21012.50,$75.00,10/28/2026 09:31:05,10/28/2026 09:35:40,4min 35sec
ESZ6,-2,0,0.25,5004,5003,1,5790.25,5800.25,$500.00,10/28/2026 11:20:00,10/28/2026 11:05:10,14min 50sec
XYZZ6,-2,0,0.01,5006,5005,2,10.00,10.50,$(1000.00),10/28/2026 12:00:00,10/28/2026 12:10:00,10min
`);

test("detects Tradovate exports and leaves other files alone", () => {
  assert.equal(detectPreset(orders.meta.fields!)?.id, "tradovate-orders");
  assert.equal(detectPreset(performance.meta.fields!)?.id, "tradovate-performance");
  assert.equal(detectPreset(["Date", "Symbol", "Side", "Quantity", "Price"]), null);
});

test("orders: keeps filled quantity only, resolves contracts", () => {
  const preset = detectPreset(orders.meta.fields!)!;
  const { executions, errors, skipped } = preset.parse(orders.data, NY);
  assert.deepEqual(errors, []);
  assert.equal(skipped, 1); // the unfilled cancel
  assert.deepEqual(
    executions.map((e) => [e.symbol, e.action, e.quantity, e.price, e.multiplier]),
    [
      ["NQZ6", "buy", 2, 21050.25, 20],
      ["NQZ6", "sell", 2, 21040.5, 20],
      ["MESZ6", "sell", 1, 5801.25, 5], // cancelled after a partial fill: the fill still counts
    ],
  );
  assert.equal(executions[0].executedAt, Date.parse("2026-10-28T13:36:12Z")); // 09:36:12 New York
  assert.ok(executions.every((e) => e.assetClass === "future" && e.fees === 0));
});

test("performance: each round trip becomes a buy and a sell", () => {
  const preset = detectPreset(performance.meta.fields!)!;
  const { executions, errors } = preset.parse(performance.data, NY);
  assert.deepEqual(errors, []);
  assert.equal(executions.length, 6);
  const es = executions.filter((e) => e.symbol === "ESZ6");
  assert.deepEqual(es.map((e) => e.action), ["sell", "buy"]); // a short: sold first, in time order
  assert.equal(es[0].multiplier, 50);
  // Unknown root: point value comes from P&L / (price move × qty) = 1000 / (0.5 × 2).
  assert.equal(executions.find((e) => e.symbol === "XYZZ6")!.multiplier, 1000);
});

test("generic matching still works for other brokers", () => {
  assert.equal(guessMapping(["Date", "Symbol", "Side", "Quantity", "Price"]).symbol, "Symbol");
});
