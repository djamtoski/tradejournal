/** Option lists for trade fields that aren't tags. Safe to import from client components. */
import type { exitReasons, tradeGrades } from "@/db/schema";

export type TradeGrade = (typeof tradeGrades)[number];
export type ExitReason = (typeof exitReasons)[number];

/** Best first, so lists and breakdowns read A+ down to C. */
export const gradeOptions: TradeGrade[] = ["A+", "A", "A-", "B+", "B", "B-", "C"];

export const exitReasonOptions: { id: ExitReason; label: string }[] = [
  { id: "target", label: "Target hit" },
  { id: "stop", label: "Stopped out" },
  { id: "breakeven", label: "Break-even stop" },
  { id: "trailing", label: "Trailing stop" },
  { id: "manual", label: "Closed manually" },
  { id: "time", label: "Time / session end" },
];

export const isGrade = (v: unknown): v is TradeGrade => gradeOptions.includes(v as TradeGrade);
export const isExitReason = (v: unknown): v is ExitReason => exitReasonOptions.some((o) => o.id === v);
export const exitReasonLabel = (v: string | null | undefined) => exitReasonOptions.find((o) => o.id === v)?.label ?? null;

/** Tags in a group named "Confluence(s)" are tracked apart from setups, like mistakes. */
export const isConfluenceGroup = (group: string | null) => !!group && /^confluences?$/i.test(group.trim());
