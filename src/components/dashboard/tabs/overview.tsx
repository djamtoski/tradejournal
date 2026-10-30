import { Kpi, Panel } from "@/components/dashboard/card";
import { EquityChart, PnlBarsChart, RDistributionChart } from "@/components/dashboard/charts";
import { Breakdown } from "@/components/dashboard/breakdown";
import { byMistake, bySide, dailySeries, groupedSeries, rDistribution, summarize } from "@/lib/stats";
import { formatPct, formatPnl, formatR, formatRatio, pnlTone, winLossLabel, formatWinRate } from "@/lib/format";
import type { TabProps } from "./types";

export function OverviewTab({ trades, filters }: TabProps) {
  const { mode } = filters;
  const s = summarize(trades, mode);
  const series = dailySeries(trades, mode);
  const periods = groupedSeries(trades, mode, filters.grouping);
  const periodTitle = { day: "Daily P&L", week: "Weekly P&L", month: "Monthly P&L" }[filters.grouping];
  const sides = bySide(trades, mode);
  const long = sides.find((r) => r.key === "long");
  const short = sides.find((r) => r.key === "short");
  const mistakes = byMistake(trades, mode);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label={`${mode === "net" ? "Net" : "Gross"} P&L`}
          value={formatPnl(s.total)}
          tone={pnlTone(s.total)}
          sub={`${s.count} trades · ${s.tradingDays} days`}
        />
        <Kpi label="Win rate" value={formatWinRate(s)} sub={winLossLabel(s)} />
        <Kpi
          label="Profit factor"
          value={formatRatio(s.profitFactor)}
          tone={s.profitFactor >= 1 ? undefined : "text-loss"}
          sub={`${s.greenDays}/${s.tradingDays} green days`}
        />
        <Kpi label="Expectancy" value={formatPnl(s.expectancy, true)} tone={pnlTone(s.expectancy)} sub="per trade" />
        <Kpi
          label="Avg win / loss"
          value={formatRatio(s.avgLoss ? s.avgWin / s.avgLoss : Infinity)}
          sub={`${formatPnl(s.avgWin)} / ${formatPnl(-s.avgLoss)}`}
        />
        <Kpi
          label="Avg R"
          value={formatR(s.avgR, 2)}
          tone={s.avgR === null ? "text-faint" : pnlTone(s.avgR)}
          sub={s.rCount ? `${formatR(s.totalR)} total · ${s.rCount} trades` : "set 1R in Settings"}
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
            <Stat label="Long" value={formatPnl(long?.pnl ?? 0)} tone={pnlTone(long?.pnl ?? 0)} hint={long ? `${long.trades} · ${long.winRate === null ? "—" : formatPct(long.winRate, 0)}` : undefined} />
            <Stat label="Short" value={formatPnl(short?.pnl ?? 0)} tone={pnlTone(short?.pnl ?? 0)} hint={short ? `${short.trades} · ${short.winRate === null ? "—" : formatPct(short.winRate, 0)}` : undefined} />
            <Stat label="Avg trades / day" value={(s.count / Math.max(1, s.tradingDays)).toFixed(1)} />
          </dl>
        </Panel>
      </div>

      <Panel title={periodTitle}>
        <div className="px-1 pb-2">
          <PnlBarsChart data={periods} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="R distribution" meta={s.rCount ? `${s.rCount} of ${s.count} trades have a risk` : undefined}>
          {s.rCount ? (
            <div className="px-1 pb-2">
              <RDistributionChart data={rDistribution(trades, mode)} />
            </div>
          ) : (
            <p className="px-4 pb-4 pt-1 text-[13px] text-faint">
              Add stops to your trades, or set 1R per account in Settings, to see results in multiples of risk.
            </p>
          )}
        </Panel>
        <Panel title="Cost of mistakes">
          {mistakes.length ? (
            <Breakdown rows={mistakes} />
          ) : (
            <p className="px-4 pb-4 pt-1 text-[13px] text-faint">Tag trades with a mistake to see what each one costs you.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
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
