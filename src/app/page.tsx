import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { FilterBar } from "@/components/shell/filter-bar";
import { OverviewTab } from "@/components/dashboard/tabs/overview";
import { ActivityTab, InstrumentsTab, SetupsTab, TimeTab } from "@/components/dashboard/tabs/breakdown-tabs";
import { dashboardTabs, parseTab, type DashboardTab } from "@/components/dashboard/tabs/types";
import { StreakStrip } from "@/components/goals/streaks";
import { readFilters } from "@/lib/filters-server";
import { getGoalHistory } from "@/lib/goals/queries";
import { isLimit } from "@/lib/goals/evaluate";
import { getAccounts, getClosedTrades, getLastTradeDay } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

const tabViews = {
  overview: OverviewTab,
  time: TimeTab,
  activity: ActivityTab,
  setups: SetupsTab,
  instruments: InstrumentsTab,
} as const;

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const filters = await readFilters(sp);
  const [trades, accounts, anyTrade, history] = await Promise.all([
    getClosedTrades(filters.range, filters),
    getAccounts(),
    getLastTradeDay(),
    tab === "overview" ? getGoalHistory() : null,
  ]);
  const View = tabViews[tab];

  return (
    <>
      <PageHeader title="Dashboard">
        <FilterBar filters={filters} accounts={accounts} showGrouping={tab === "overview"} />
      </PageHeader>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6">
        <TabNav active={tab} sp={sp} />
        {history && history.days.length > 0 && trades.length > 0 && (
          <StreakStrip streaks={history.streaks} hasLimits={history.goals.some((g) => g.active && isLimit(g))} />
        )}
        {trades.length ? <View trades={trades} filters={filters} /> : anyTrade ? <NoMatches /> : <EmptyState />}
      </div>
    </>
  );
}

/** Underline tabs; keeps any range/mode deep-link override when switching. */
function TabNav({ active, sp }: { active: DashboardTab; sp: Record<string, string | string[] | undefined> }) {
  const href = (id: DashboardTab) => {
    const params = new URLSearchParams();
    if (id !== "overview") params.set("tab", id);
    for (const key of ["range", "mode"] as const) if (typeof sp[key] === "string") params.set(key, sp[key] as string);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };
  return (
    <nav aria-label="Dashboard sections" className="-mt-2 flex gap-1 border-b border-border">
      {dashboardTabs.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          scroll={false}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "relative px-3 pb-2.5 pt-1 text-[13px] transition-colors",
            active === t.id
              ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function NoMatches() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-6 py-20 text-center">
      <h2 className="text-[17px]">No trades match these filters</h2>
      <p className="text-muted-foreground">Try a longer range, or include more accounts or asset classes.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-20 text-center">
      <h2 className="text-[17px]">Start your journal</h2>
      <p className="text-muted-foreground">
        Import a broker export to see your P&L, win rate and setups here.
      </p>
      <Link
        href="/import"
        className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Import trades
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[10px] border border-border bg-card" />
          ))}
        </div>
        <div className="h-[310px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
