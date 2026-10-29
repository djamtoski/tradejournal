/**
 * Groups one symbol's fills into round-trip trades: a trade opens when the
 * position leaves flat and closes when it returns to flat. A fill that flips
 * the position (long 2 → short 1) is split across the two trades.
 */

export type Fill = {
  id: number;
  action: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  executedAt: number;
};

export type BuiltTrade = {
  side: "long" | "short";
  /** Largest absolute position held during the trade. */
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  openedAt: number;
  closedAt: number | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
  fillIds: number[];
};

const EPS = 1e-9;

export function buildTrades(fills: Fill[], multiplier: number): BuiltTrade[] {
  const sorted = [...fills].sort((a, b) => a.executedAt - b.executedAt || a.id - b.id);
  const trades: BuiltTrade[] = [];

  let cur: {
    side: "long" | "short";
    position: number; // signed
    maxQty: number;
    openQty: number; openCost: number;
    closeQty: number; closeCost: number;
    cash: number; // signed cash flow, before multiplier
    fees: number;
    openedAt: number;
    fillIds: number[];
  } | null = null;

  const finish = (closedAt: number | null) => {
    if (!cur) return;
    const closed = closedAt !== null;
    const gross = closed ? round(cur.cash * multiplier) : 0;
    trades.push({
      side: cur.side,
      quantity: cur.maxQty,
      entryPrice: round(cur.openCost / cur.openQty, 6),
      exitPrice: cur.closeQty > EPS ? round(cur.closeCost / cur.closeQty, 6) : null,
      openedAt: cur.openedAt,
      closedAt,
      grossPnl: gross,
      fees: round(cur.fees),
      netPnl: closed ? round(gross - cur.fees) : 0,
      fillIds: cur.fillIds,
    });
    cur = null;
  };

  for (const f of sorted) {
    let remaining = f.quantity;
    const signed = f.action === "buy" ? 1 : -1;

    while (remaining > EPS) {
      if (!cur) {
        cur = {
          side: signed > 0 ? "long" : "short",
          position: 0, maxQty: 0,
          openQty: 0, openCost: 0, closeQty: 0, closeCost: 0,
          cash: 0, fees: 0, openedAt: f.executedAt, fillIds: [],
        };
      }

      const opening = Math.sign(cur.position) === signed || Math.abs(cur.position) < EPS;
      // Closing fills can only use up the current position; the rest flips.
      const qty = opening ? remaining : Math.min(remaining, Math.abs(cur.position));
      const share = qty / f.quantity;

      cur.position += signed * qty;
      cur.cash -= signed * qty * f.price;
      cur.fees += f.fees * share;
      if (!cur.fillIds.includes(f.id)) cur.fillIds.push(f.id);
      if (opening) {
        cur.openQty += qty;
        cur.openCost += qty * f.price;
      } else {
        cur.closeQty += qty;
        cur.closeCost += qty * f.price;
      }
      cur.maxQty = Math.max(cur.maxQty, Math.abs(cur.position));
      remaining -= qty;

      if (Math.abs(cur.position) < EPS) finish(f.executedAt);
    }
  }

  finish(null); // still-open position
  return trades;
}

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
