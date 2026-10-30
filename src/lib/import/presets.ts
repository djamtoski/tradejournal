/**
 * Broker presets: recognise a known export by its headers and turn its rows
 * straight into fills, skipping the column-matching step. Runs in the browser
 * (upload preview) and on the server (inbox folder).
 */

import { resolveFuture } from "../instruments";
import { parseDateTime, parseNumber, parseSide, type ParsedExecution, type RowError } from "./parse";

export type PresetResult = {
  executions: ParsedExecution[];
  errors: RowError[];
  /** Rows that are fine but carry no fill, e.g. cancelled orders. */
  skipped: number;
};

export type Preset = {
  id: string;
  label: string;
  /** Saved as the import's broker label. */
  broker: string;
  /** Shown under the detection banner. */
  note: string;
  detect: (headers: string[]) => boolean;
  parse: (rows: Record<string, string>[], timezone: string) => PresetResult;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Finds the first header matching any of the names, ignoring case and punctuation. */
function column(headers: string[], ...names: string[]) {
  const wanted = names.map(norm);
  return headers.find((h) => wanted.includes(norm(h)));
}

const cell = (row: Record<string, string>, col: string | undefined) => (col ? String(row[col] ?? "").trim() : "");

const isBlank = (row: Record<string, string>) => Object.values(row).every((v) => !String(v ?? "").trim());

/** Point value for a futures contract: the known root, else derived from the row's P&L. */
function multiplierFor(symbol: string, derive?: () => number | null) {
  return resolveFuture(symbol)?.multiplier ?? derive?.() ?? null;
}

const tradovateOrders: Preset = {
  id: "tradovate-orders",
  label: "Tradovate orders",
  broker: "Tradovate",
  note: "One fill per filled order at its average price. The orders export has no commissions, so fees are 0.",
  detect: (h) =>
    !!column(h, "B/S") && !!column(h, "Contract") && !!column(h, "Status") &&
    !!column(h, "filledQty", "Filled Qty") && !!column(h, "avgPrice", "Avg Fill Price", "decimalFillAvg"),
  parse(rows, timezone) {
    const h = Object.keys(rows[0] ?? {});
    const col = {
      side: column(h, "B/S"),
      contract: column(h, "Contract"),
      qty: column(h, "filledQty", "Filled Qty"),
      price: column(h, "avgPrice", "Avg Fill Price", "decimalFillAvg"),
      time: column(h, "Fill Time"),
      fallbackTime: column(h, "Timestamp", "Date"),
    };
    const out: PresetResult = { executions: [], errors: [], skipped: 0 };
    rows.forEach((row, i) => {
      const rowNo = i + 2;
      if (isBlank(row)) return;
      // Cancelled and working orders have no fill; a partly filled cancel still counts.
      const qty = parseNumber(cell(row, col.qty));
      if (!qty) return void out.skipped++;

      const symbol = cell(row, col.contract).toUpperCase();
      if (!symbol) return void out.errors.push({ row: rowNo, message: "Missing contract" });
      const action = parseSide(cell(row, col.side));
      if (!action) return void out.errors.push({ row: rowNo, message: `Unknown side "${cell(row, col.side)}"` });
      const price = parseNumber(cell(row, col.price));
      if (price === null || price < 0) return void out.errors.push({ row: rowNo, message: "Missing fill price" });
      const executedAt = parseDateTime(cell(row, col.time) || cell(row, col.fallbackTime), timezone);
      if (executedAt === null) return void out.errors.push({ row: rowNo, message: "Unreadable fill time" });
      const multiplier = multiplierFor(symbol);
      if (multiplier === null) return void out.errors.push({ row: rowNo, message: `Unknown contract ${symbol}` });

      out.executions.push({ symbol, assetClass: "future", action, quantity: Math.abs(qty), price, fees: 0, multiplier, executedAt });
    });
    return out;
  },
};

const tradovatePerformance: Preset = {
  id: "tradovate-performance",
  label: "Tradovate performance",
  broker: "Tradovate",
  note: "Each row is a matched buy and sell, so it becomes two fills. P&L in this export is before commissions, so fees are 0.",
  detect: (h) =>
    !!column(h, "buyPrice") && !!column(h, "sellPrice") && !!column(h, "boughtTimestamp") && !!column(h, "soldTimestamp"),
  parse(rows, timezone) {
    const h = Object.keys(rows[0] ?? {});
    const col = {
      symbol: column(h, "symbol"),
      qty: column(h, "qty"),
      buyPrice: column(h, "buyPrice"),
      sellPrice: column(h, "sellPrice"),
      pnl: column(h, "pnl"),
      bought: column(h, "boughtTimestamp"),
      sold: column(h, "soldTimestamp"),
    };
    const out: PresetResult = { executions: [], errors: [], skipped: 0 };
    rows.forEach((row, i) => {
      const rowNo = i + 2;
      if (isBlank(row)) return;
      const symbol = cell(row, col.symbol).toUpperCase();
      if (!symbol) return void out.errors.push({ row: rowNo, message: "Missing symbol" });
      const qty = parseNumber(cell(row, col.qty));
      if (!qty) return void out.errors.push({ row: rowNo, message: "Missing or zero quantity" });
      const buy = parseNumber(cell(row, col.buyPrice));
      const sell = parseNumber(cell(row, col.sellPrice));
      if (buy === null || sell === null) return void out.errors.push({ row: rowNo, message: "Missing buy or sell price" });
      const boughtAt = parseDateTime(cell(row, col.bought), timezone);
      const soldAt = parseDateTime(cell(row, col.sold), timezone);
      if (boughtAt === null || soldAt === null) return void out.errors.push({ row: rowNo, message: "Unreadable timestamp" });

      const multiplier = multiplierFor(symbol, () => {
        const pnl = parseNumber(cell(row, col.pnl));
        const move = Math.abs(sell - buy) * Math.abs(qty);
        return pnl && move ? Math.round((Math.abs(pnl) / move) * 1000) / 1000 : null;
      });
      if (multiplier === null) return void out.errors.push({ row: rowNo, message: `Unknown contract ${symbol}` });

      const base = { symbol, assetClass: "future" as const, quantity: Math.abs(qty), fees: 0, multiplier };
      out.executions.push(
        { ...base, action: "buy", price: buy, executedAt: boughtAt },
        { ...base, action: "sell", price: sell, executedAt: soldAt },
      );
    });
    // Fills in time order, so a short (sold first) reads naturally in the preview.
    out.executions.sort((a, b) => a.executedAt - b.executedAt);
    return out;
  },
};

export const presets: Preset[] = [tradovateOrders, tradovatePerformance];

export const detectPreset = (headers: string[]) => presets.find((p) => p.detect(headers)) ?? null;
