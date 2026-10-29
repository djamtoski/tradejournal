/** Background tint for a P&L cell, scaled by size relative to the period's largest day. */
export function pnlTint(pnl: number, max: number) {
  if (!pnl || !max) return undefined;
  const strength = 8 + Math.round(Math.min(1, Math.abs(pnl) / max) * 22); // 8–30%
  const color = pnl > 0 ? "var(--profit)" : "var(--loss)";
  return { backgroundColor: `color-mix(in srgb, ${color} ${strength}%, transparent)` };
}
