/**
 * Turns rows from any broker CSV into normalized executions via a column
 * mapping. Runs in the browser (preview) and on the server (validation).
 */

import { zonedInstant } from "../tz";

export type AssetClass = "stock" | "future" | "forex" | "option" | "cfd";

export type ParsedExecution = {
  symbol: string;
  assetClass: AssetClass;
  action: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  multiplier: number;
  executedAt: number; // epoch ms
};

export const fields = [
  { id: "datetime", label: "Date and time", required: false },
  { id: "date", label: "Date", required: false },
  { id: "time", label: "Time", required: false },
  { id: "symbol", label: "Symbol", required: true },
  { id: "side", label: "Side", required: false },
  { id: "quantity", label: "Quantity", required: true },
  { id: "price", label: "Price", required: true },
  { id: "fees", label: "Fees", required: false },
  { id: "assetClass", label: "Asset class", required: false },
  { id: "multiplier", label: "Multiplier", required: false },
] as const;

export type FieldId = (typeof fields)[number]["id"];
export type Mapping = Partial<Record<FieldId, string>>;

/** Header aliases, matched case- and punctuation-insensitively. */
const aliases: Record<FieldId, string[]> = {
  datetime: ["datetime", "date time", "timestamp", "execution time", "exec time", "filled time", "fill time", "trade time", "time placed"],
  date: ["date", "trade date", "exec date", "execution date", "fill date"],
  time: ["time", "exec time", "execution time", "fill time"],
  symbol: ["symbol", "ticker", "instrument", "contract", "underlying", "security", "product"],
  side: ["side", "action", "buy sell", "b s", "direction", "type", "transaction type"],
  quantity: ["quantity", "qty", "shares", "size", "filled qty", "contracts", "amount", "filled"],
  price: ["price", "fill price", "exec price", "execution price", "avg price", "average price", "trade price"],
  fees: ["fees", "fee", "commission", "commissions", "comm", "total fees", "comm fee"],
  assetClass: ["asset class", "asset type", "security type", "instrument type", "sec type"],
  multiplier: ["multiplier", "contract multiplier", "point value", "mult"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Best-guess mapping from CSV headers. Each header is used once. A sample row
 * lets us tell a full timestamp column from a time-only one.
 */
export function guessMapping(headers: string[], sample?: Record<string, string>): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  // Specific fields first so "Exec Time" goes to datetime before time.
  const order: FieldId[] = ["datetime", "date", "time", "symbol", "side", "quantity", "price", "fees", "assetClass", "multiplier"];
  for (const field of order) {
    const match = headers.find((h) => !used.has(h) && aliases[field].includes(norm(h)));
    if (match) {
      mapping[field] = match;
      used.add(match);
    }
  }
  // A "datetime" guess holding only a time ("09:31:02") is really the time column.
  if (mapping.datetime && sample && parseDateTime(sample[mapping.datetime] ?? "", "UTC") === null) {
    if (!mapping.time) mapping.time = mapping.datetime;
    delete mapping.datetime;
  }
  // A lone "date" column acts as datetime (it may carry times too).
  if (!mapping.datetime && mapping.date && !mapping.time) {
    mapping.datetime = mapping.date;
    delete mapping.date;
  }
  return mapping;
}

export function mappingProblems(mapping: Mapping): string[] {
  const problems: string[] = [];
  for (const f of fields) if (f.required && !mapping[f.id]) problems.push(`Map a column to ${f.label}.`);
  if (!mapping.datetime && !mapping.date) problems.push("Map a column to Date and time, or Date.");
  return problems;
}

export type RowError = { row: number; message: string };

export function parseRows(
  rows: Record<string, string>[],
  mapping: Mapping,
  defaults: { assetClass: AssetClass; multiplier: number; timezone: string },
): { executions: ParsedExecution[]; errors: RowError[] } {
  const executions: ParsedExecution[] = [];
  const errors: RowError[] = [];
  const get = (row: Record<string, string>, f: FieldId) => {
    const col = mapping[f];
    return col ? (row[col] ?? "").trim() : "";
  };

  rows.forEach((row, i) => {
    const rowNo = i + 2; // header is row 1
    if (Object.values(row).every((v) => !String(v ?? "").trim())) return;

    const symbol = get(row, "symbol").toUpperCase();
    if (!symbol) return void errors.push({ row: rowNo, message: "Missing symbol" });

    const rawQty = parseNumber(get(row, "quantity"));
    if (rawQty === null || rawQty === 0) return void errors.push({ row: rowNo, message: "Missing or zero quantity" });

    const price = parseNumber(get(row, "price"));
    if (price === null || price < 0) return void errors.push({ row: rowNo, message: "Missing price" });

    const sideText = get(row, "side");
    const action = sideText ? parseSide(sideText) : rawQty > 0 ? "buy" : "sell";
    if (!action) return void errors.push({ row: rowNo, message: `Unknown side "${sideText}"` });

    const when = mapping.datetime
      ? parseDateTime(get(row, "datetime"), defaults.timezone)
      : parseDateTime(`${get(row, "date")} ${get(row, "time")}`.trim(), defaults.timezone);
    if (when === null) return void errors.push({ row: rowNo, message: "Unreadable date or time" });

    const assetClass = parseAssetClass(get(row, "assetClass")) ?? defaults.assetClass;
    const multiplier = parseNumber(get(row, "multiplier")) ?? (assetClass === "option" ? 100 : defaults.multiplier);

    executions.push({
      symbol,
      assetClass,
      action,
      quantity: Math.abs(rawQty),
      price,
      fees: Math.abs(parseNumber(get(row, "fees")) ?? 0),
      multiplier: multiplier || 1,
      executedAt: when,
    });
  });

  return { executions, errors };
}

/** "1,234.50", "$12", "(3.20)" → number. */
export function parseNumber(s: string): number | null {
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s.trim());
  const cleaned = s.replace(/[$,\s()]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

export function parseSide(s: string): "buy" | "sell" | null {
  const v = norm(s);
  if (/^(b|buy|bot|bought|long|buy to open|buy to close|btc|bto|cover|buy to cover)$/.test(v)) return "buy";
  if (/^(s|sell|sld|sold|short|sell short|ss|sell to open|sell to close|stc|sto)$/.test(v)) return "sell";
  if (v.startsWith("buy")) return "buy";
  if (v.startsWith("sell")) return "sell";
  return null;
}

function parseAssetClass(s: string): AssetClass | null {
  const v = norm(s);
  if (!v) return null;
  if (/^(stk|stock|stocks|equity|equities|etf|shares)$/.test(v)) return "stock";
  if (/^(fut|future|futures)$/.test(v)) return "future";
  if (/^(fx|forex|cash|currency)$/.test(v)) return "forex";
  if (/^(opt|option|options)$/.test(v)) return "option";
  if (/^(cfd|cfds)$/.test(v)) return "cfd";
  return null;
}

/**
 * Accepts ISO ("2026-10-05T09:31:02"), "2026-10-05 09:31", "10/05/2026 9:31:02 AM",
 * "05.10.2026 09:31". Times are wall-clock times in `tz` (the trading timezone).
 */
export function parseDateTime(s: string, tz: string): number | null {
  const v = s.trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(am|pm)?)?/i);
  if (m) return build(tz, +m[1], +m[2], +m[3], m[4], m[5], m[6], m[7], m[8]);

  // US month/day/year; dotted dates are day.month.year.
  m = v.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(am|pm)?)?/i);
  if (m) {
    const year = m[4].length === 2 ? 2000 + +m[4] : +m[4];
    const [month, day] = m[2] === "." ? [+m[3], +m[1]] : [+m[1], +m[3]];
    return build(tz, year, month, day, m[5], m[6], m[7], m[8], m[9]);
  }
  return null;
}

function build(
  tz: string,
  y: number, mo: number, d: number,
  h?: string, mi?: string, sec?: string, frac?: string, ampm?: string,
): number | null {
  let hour = h ? +h : 0;
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (hour === 12) hour = pm ? 12 : 0;
    else if (pm) hour += 12;
  }
  const ms = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  // Reject impossible dates (Feb 30) before converting the wall time to an instant.
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  if (hour > 23 || (mi && +mi > 59) || (sec && +sec > 59)) return null;
  return zonedInstant(tz, y, mo, d, hour, mi ? +mi : 0, sec ? +sec : 0, ms).getTime();
}

/**
 * Stable id for a fill. Identical fills in one file are told apart by their
 * occurrence index, so re-importing the same file skips every row.
 */
export function fingerprints(executions: ParsedExecution[]): string[] {
  const seen = new Map<string, number>();
  return executions.map((e) => {
    const base = [e.symbol, e.action, e.quantity, e.price, e.executedAt].join("|");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}
