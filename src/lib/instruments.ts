/**
 * Known futures contracts and their point values ($ per 1.00 move per contract).
 * Used to pre-fill multipliers for manual trades and broker imports.
 */

export type AssetClass = "stock" | "future" | "forex" | "option" | "cfd";

export const futures: Record<string, { name: string; multiplier: number }> = {
  NQ: { name: "E-mini Nasdaq-100", multiplier: 20 },
  MNQ: { name: "Micro E-mini Nasdaq-100", multiplier: 2 },
  ES: { name: "E-mini S&P 500", multiplier: 50 },
  MES: { name: "Micro E-mini S&P 500", multiplier: 5 },
  YM: { name: "E-mini Dow", multiplier: 5 },
  MYM: { name: "Micro E-mini Dow", multiplier: 0.5 },
  RTY: { name: "E-mini Russell 2000", multiplier: 50 },
  M2K: { name: "Micro E-mini Russell 2000", multiplier: 5 },
  CL: { name: "Crude Oil", multiplier: 1000 },
  MCL: { name: "Micro Crude Oil", multiplier: 100 },
  GC: { name: "Gold", multiplier: 100 },
  MGC: { name: "Micro Gold", multiplier: 10 },
  SI: { name: "Silver", multiplier: 5000 },
  SIL: { name: "Micro Silver", multiplier: 1000 },
  HG: { name: "Copper", multiplier: 25000 },
  NG: { name: "Natural Gas", multiplier: 10000 },
  ZN: { name: "10-Year T-Note", multiplier: 1000 },
  ZB: { name: "30-Year T-Bond", multiplier: 1000 },
  "6E": { name: "Euro FX", multiplier: 125000 },
  M6E: { name: "Micro Euro FX", multiplier: 12500 },
  "6B": { name: "British Pound", multiplier: 62500 },
  "6J": { name: "Japanese Yen", multiplier: 12500000 },
};

// Contract month codes: F G H J K M N Q U V X Z.
const MONTH = "[FGHJKMNQUVXZ]";

/**
 * Resolves a typed or exported symbol to a known futures root, e.g. "NQZ6",
 * "nqz26", "MNQ H7", "ES 12-26" or "NQ". Returns null for anything else.
 */
export function resolveFuture(symbol: string): { root: string; multiplier: number; name: string } | null {
  const s = symbol.trim().toUpperCase().replace(/^\//, "");
  // Longest roots first so "MNQ" isn't read as "NQ" with a stray M.
  const roots = Object.keys(futures).sort((a, b) => b.length - a.length);
  for (const root of roots) {
    const pattern = new RegExp(`^${root}(?:\\s*${MONTH}\\d{1,2}|\\s+\\d{1,2}[-/]\\d{2,4})?$`);
    if (pattern.test(s)) return { root, ...futures[root] };
  }
  return null;
}
