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

/** "+2.4R" / "−0.5R"; "—" when the trade has no risk. */
export function formatR(r: number | null, digits = 1) {
  if (r === null || !Number.isFinite(r)) return "—";
  const abs = Math.abs(r).toFixed(digits);
  if (Number(abs) === 0) return `${abs}R`;
  return `${r > 0 ? "+" : "−"}${abs}R`;
}

/** "3W · 2L", plus "· 1BE" when there are break-even scratches. */
export const winLossLabel = (s: { wins: number; losses: number; breakevens: number }) =>
  `${s.wins}W · ${s.losses}L${s.breakevens ? ` · ${s.breakevens}BE` : ""}`;

/** Win rate over decided trades; "—" when every trade so far is a scratch. */
export const formatWinRate = (s: { winRate: number; wins: number; losses: number }, digits = 1) =>
  s.wins + s.losses ? formatPct(s.winRate, digits) : "—";
