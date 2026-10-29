/**
 * Validation and P&L for trades entered by hand. Pure, so the same rules run in
 * tests and in the server action. Times arrive as `datetime-local` strings
 * ("YYYY-MM-DDTHH:mm") meant in the trading timezone.
 */
import type { AssetClass } from "@/lib/instruments";
import { zonedInstant, zonedParts } from "@/lib/tz";

export type ManualTradeInput = {
  accountId: number;
  symbol: string;
  assetClass: AssetClass;
  side: "long" | "short";
  quantity: number;
  multiplier: number;
  entryPrice: number;
  exitPrice: number | null;
  openedAt: string;
  closedAt: string | null;
  fees: number;
};

export type ManualTradeValues = {
  accountId: number;
  symbol: string;
  assetClass: AssetClass;
  side: "long" | "short";
  quantity: number;
  multiplier: number;
  entryPrice: number;
  exitPrice: number | null;
  openedAt: Date;
  closedAt: Date | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
};

export type FieldErrors = Partial<Record<keyof ManualTradeInput, string>>;

const assetClasses = ["stock", "future", "forex", "option"];
const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** "2026-10-05T09:31" in `tz` → instant. Null for anything malformed or impossible. */
export function parseLocalDateTime(value: string | null | undefined, tz: string): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return null;
  return zonedInstant(tz, y, mo, d, h, mi, s);
}

/** Instant → "YYYY-MM-DDTHH:mm" in `tz`, for pre-filling a datetime-local input. */
export function toLocalDateTime(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function validateManualTrade(
  input: ManualTradeInput,
  tz: string,
): { ok: true; values: ManualTradeValues } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const symbol = String(input.symbol ?? "").trim().toUpperCase();

  if (!Number.isInteger(input.accountId) || input.accountId <= 0) errors.accountId = "Choose an account.";
  if (!symbol || symbol.length > 32) errors.symbol = "Enter a symbol.";
  if (!assetClasses.includes(input.assetClass)) errors.assetClass = "Choose an asset class.";
  if (input.side !== "long" && input.side !== "short") errors.side = "Choose long or short.";
  if (!num(input.quantity) || input.quantity <= 0) errors.quantity = "Enter a quantity above 0.";
  if (!num(input.multiplier) || input.multiplier <= 0) errors.multiplier = "Enter a multiplier above 0.";
  if (!num(input.entryPrice) || input.entryPrice < 0) errors.entryPrice = "Enter the entry price.";
  if (input.exitPrice !== null && (!num(input.exitPrice) || input.exitPrice < 0)) errors.exitPrice = "Enter a valid exit price.";
  if (!num(input.fees) || input.fees < 0) errors.fees = "Fees can't be negative.";

  const openedAt = parseLocalDateTime(input.openedAt, tz);
  if (!openedAt) errors.openedAt = "Enter when the trade opened.";
  const closedAt = input.closedAt ? parseLocalDateTime(input.closedAt, tz) : null;
  if (input.closedAt && !closedAt) errors.closedAt = "Enter a valid close time.";

  const hasExit = input.exitPrice !== null;
  if (hasExit && !input.closedAt) errors.closedAt = "Add when the trade closed.";
  if (!hasExit && input.closedAt) errors.exitPrice = "Add the exit price, or clear the close time to keep it open.";
  if (openedAt && closedAt && closedAt < openedAt) errors.closedAt = "The close can't be before the open.";

  if (Object.keys(errors).length) return { ok: false, errors };

  const direction = input.side === "long" ? 1 : -1;
  const closed = hasExit && closedAt !== null;
  const gross = closed ? round((input.exitPrice! - input.entryPrice) * direction * input.quantity * input.multiplier) : 0;
  const fees = round(input.fees);

  return {
    ok: true,
    values: {
      accountId: input.accountId,
      symbol,
      assetClass: input.assetClass,
      side: input.side,
      quantity: input.quantity,
      multiplier: input.multiplier,
      entryPrice: input.entryPrice,
      exitPrice: closed ? input.exitPrice : null,
      openedAt: openedAt!,
      closedAt: closed ? closedAt : null,
      grossPnl: gross,
      fees,
      netPnl: closed ? round(gross - fees) : 0,
    },
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
