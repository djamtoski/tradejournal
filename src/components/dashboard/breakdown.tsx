import { cn } from "@/lib/utils";
import { formatPct, formatPnl, pnlTone } from "@/lib/format";

type Row = { key: string; pnl: number; trades: number; winRate: number };

/** Diverging horizontal bars: losses grow left, profits grow right of a center line. */
export function Breakdown({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  return (
    <div className="flex flex-col px-4 pb-3 pt-2">
      {rows.map((r) => {
        const width = `${(Math.abs(r.pnl) / max) * 50}%`;
        return (
          <div
            key={r.key}
            className="grid h-8 grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-[13px]"
          >
            <span className="truncate text-foreground">{r.key}</span>
            <div className="relative h-1.5 rounded-full bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-input" />
              <span
                className={cn(
                  "absolute inset-y-0 rounded-full",
                  r.pnl >= 0 ? "left-1/2 bg-profit" : "right-1/2 bg-loss",
                )}
                style={{ width }}
              />
            </div>
            <span className="flex flex-col items-end leading-tight">
              <span className={cn("num text-[13px]", pnlTone(r.pnl))}>{formatPnl(r.pnl)}</span>
              <span className="num text-[11px] text-faint">
                {r.trades} · {formatPct(r.winRate, 0)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
