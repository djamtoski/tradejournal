const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "+$1,234" / "−$56". Uses a real minus sign so columns align. */
export function formatPnl(n: number, precise = false) {
  const f = precise ? moneyPrecise : money;
  const abs = f.format(Math.abs(n));
  if (Math.round(n * (precise ? 100 : 1)) === 0) return abs;
  return n > 0 ? `+${abs}` : `−${abs}`;
}

export const formatMoney = (n: number) => money.format(n);

export const formatPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export const formatRatio = (n: number) =>
  Number.isFinite(n) ? n.toFixed(2) : "∞";

export const pnlTone = (n: number) =>
  n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted-foreground";
