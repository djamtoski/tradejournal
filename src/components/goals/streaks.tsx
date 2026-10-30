import Link from "next/link";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { streakKinds, type Streak, type StreakId } from "@/lib/goals/evaluate";

const plural = (n: number, unit: string) => `${n} ${n === 1 ? unit.replace(/s$/, "") : unit}`;

/** Current and best run for each streak. `hasLimits` = false hides the limits streak's number. */
export function StreakTiles({ streaks, hasLimits }: { streaks: Record<StreakId, Streak>; hasLimits: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {streakKinds.map((k) => {
        const s = streaks[k.id];
        const off = k.id === "withinLimits" && !hasLimits;
        const onBest = !off && s.current > 0 && s.current === s.longest;
        return (
          <div key={k.id} className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-card px-4 py-3.5">
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              {k.label}
              {onBest && <Flame className="size-3 text-primary" strokeWidth={2} aria-label="Personal best" />}
            </span>
            <span className={cn("num text-[24px] leading-none tracking-tight", off || !s.current ? "text-faint" : "text-foreground")}>
              {off ? "—" : s.current}
              {!off && <span className="ml-1 text-[13px] text-faint">{s.current === 1 ? k.unit.replace(/s$/, "") : k.unit}</span>}
            </span>
            <span className="num truncate text-[12px] text-faint">
              {off ? "Add a daily limit to track this" : `Best ${plural(s.longest, k.unit)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One-line version for the dashboard Overview. */
export function StreakStrip({ streaks, hasLimits }: { streaks: Record<StreakId, Streak>; hasLimits: boolean }) {
  return (
    <Link
      href="/goals"
      className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[10px] border border-border bg-card px-4 py-2.5 text-[13px] transition-colors hover:border-input"
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Flame className="size-3.5" strokeWidth={1.5} /> Streaks
      </span>
      {streakKinds
        .filter((k) => k.id !== "withinLimits" || hasLimits)
        .map((k) => (
          <span key={k.id} className="flex items-baseline gap-1.5">
            <span className="text-faint">{k.label}</span>
            <span className={cn("num", streaks[k.id].current ? "text-foreground" : "text-faint")}>{streaks[k.id].current}</span>
            <span className="num text-[11px] text-faint">/ {streaks[k.id].longest} best</span>
          </span>
        ))}
    </Link>
  );
}
