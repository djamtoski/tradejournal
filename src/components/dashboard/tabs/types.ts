import type { Filters } from "@/lib/filters";
import type { JournalTrade } from "@/lib/queries";

export type TabProps = { trades: JournalTrade[]; filters: Filters };

export const dashboardTabs = [
  { id: "overview", label: "Overview" },
  { id: "time", label: "Time" },
  { id: "activity", label: "Activity" },
  { id: "setups", label: "Setups" },
  { id: "instruments", label: "Instruments" },
] as const;

export type DashboardTab = (typeof dashboardTabs)[number]["id"];

export const parseTab = (v: unknown): DashboardTab =>
  dashboardTabs.some((t) => t.id === v) ? (v as DashboardTab) : "overview";
