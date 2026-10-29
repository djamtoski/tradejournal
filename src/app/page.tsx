import { Suspense } from "react";
import Link from "next/link";
import { FilterBar, PageHeader } from "@/components/shell/page-header";
import { Kpi, Panel } from "@/components/dashboard/card";
import { DailyPnlChart, EquityChart } from "@/components/dashboard/charts";
import { Breakdown } from "@/components/dashboard/breakdown";
import { parseFilters, type Filters } from "@/lib/filters";
import { getClosedTrades } from "@/lib/queries";
import {
  byHour,
  byMistake,
  bySide,
  bySymbol,
  byTag,
  byWeekday,
  dailySeries,
  summarize,
} from "@/lib/stats";
import { formatPct, formatPnl, formatRatio, pnlTone } from "@/lib/format";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  const trades = await getClosedTrades(filters.range);

  return (
    <>
      <PageHeader title="Dashboard">
        <FilterBar filters={filters} />
      </PageHeader>
      {trades.length ? <Overview trades={trades} filters={filters} /> : <EmptyState />}
    </>
  );
}

function Overview({
  trades,
  filters,
}: {
  trades: Awaited<ReturnType<typeof getClosedTrades>>;
  filters: Filters;
}) {
  const { mode } = filters;
  const s = summarize(trades, mode);
  const series = dailySeries(trades, mode);
  const sides = bySide(trades, mode);
  const long = sides.find((r) => r.key === "long");
  const short = sides.find((r) => r.key === "short");
  const mistakes = byMistake(trades, mode);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label={`${mode === "net" ? "Net" : "Gross"} P&L`}
          value={formatPnl(s.total)}
          tone={pnlTone(s.total)}
          sub={`${s.count} trades · ${s.tradingDays} days`}
        />
        <Kpi
          label="Win rate"
          value={formatPct(s.winRate)}
          sub={`${s.wins}W · ${s.losses}L`}
        />
        <Kpi
          label="Profit factor"
          value={formatRatio(s.profitFactor)}
          tone={s.profitFactor >= 1 ? undefined : "text-loss"}
          sub={`${s.greenDays}/${s.tradingDays} green days`}
        />
        <Kpi
          label="Expectancy"
          value={formatPnl(s.expectancy, true)}
          tone={pnlTone(s.expectancy)}
          sub="per trade"
        />
        <Kpi
          label="Avg win / loss"
          value={formatRatio(s.avgLoss ? s.avgWin / s.avgLoss : Infinity)}
          sub={`${formatPnl(s.avgWin)} / ${formatPnl(-s.avgLoss)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="Equity curve" meta={`${series.length} trading days`}>
          <div className="px-1 pb-2">
            <EquityChart data={series} />
          </div>
        </Panel>
        <Panel title="Highlights">
          <dl className="flex flex-col px-4 pb-3 pt-1 text-[13px]">
            <Stat label="Best day" value={s.bestDay ? formatPnl(s.bestDay.pnl) : "—"} tone={s.bestDay ? pnlTone(s.bestDay.pnl) : undefined} hint={s.bestDay?.day} />
            <Stat label="Worst day" value={s.worstDay ? formatPnl(s.worstDay.pnl) : "—"} tone={s.worstDay ? pnlTone(s.worstDay.pnl) : undefined} hint={s.worstDay?.day} />
            <Stat label="Long" value={formatPnl(long?.pnl ?? 0)} tone={pnlTone(long?.pnl ?? 0)} hint={long ? `${long.trades} · ${formatPct(long.winRate, 0)}` : undefined} />
            <Stat label="Short" value={formatPnl(short?.pnl ?? 0)} tone={pnlTone(short?.pnl ?? 0)} hint={short ? `${short.trades} · ${formatPct(short.winRate, 0)}` : undefined} />
            <Stat label="Avg trades / day" value={(s.count / Math.max(1, s.tradingDays)).toFixed(1)} />
          </dl>
        </Panel>
      </div>

      <Panel title="Daily P&L">
        <div className="px-1 pb-2">
          <DailyPnlChart data={series} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="By setup">
          <Breakdown rows={byTag(trades, mode)} />
        </Panel>
        <Panel title="Cost of mistakes">
          {mistakes.length ? (
            <Breakdown rows={mistakes} />
          ) : (
            <p className="px-4 pb-4 pt-1 text-[13px] text-faint">
              Tag trades with a mistake to see what each one costs you.
            </p>
          )}
        </Panel>
        <Panel title="By symbol">
          <Breakdown rows={bySymbol(trades, mode)} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="By weekday">
          <Breakdown rows={byWeekday(trades, mode)} />
        </Panel>
        <Panel title="By entry hour">
          <Breakdown rows={byHour(trades, mode)} />
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex flex-col items-end leading-tight">
        <span className={`num ${tone ?? "text-foreground"}`}>{value}</span>
        {hint && <span className="num text-[11px] text-faint">{hint}</span>}
      </dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
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
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[10px] border border-border bg-card" />
          ))}
        </div>
        <div className="h-[310px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
