import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { FilterBar } from "@/components/shell/filter-bar";
import { readFilters } from "@/lib/filters-server";
import { Kpi, Panel } from "@/components/dashboard/card";
import { IntradayChart } from "@/components/daily/intraday-chart";
import { JournalEditor } from "@/components/daily/journal-editor";
import { ScreenshotThumb } from "@/components/screenshots/thumb";
import { getScreenshots } from "@/lib/screenshots/queries";
import { cn } from "@/lib/utils";
import { monthKey, parseDay } from "@/lib/dates";
import {
  getAccounts,
  getOpenTrades,
  getAdjacentTradingDay,
  getClosedTradesInDays,
  getJournalEntry,
  getLastTradeDay,
  type JournalTrade,
} from "@/lib/queries";
import { getSettings } from "@/lib/settings/queries";
import { getGoals } from "@/lib/goals/queries";
import { evaluateDay, isLimit, type Breach } from "@/lib/goals/evaluate";
import { getReview } from "@/lib/review/queries";
import { ReviewBody } from "@/components/review/review-body";
import { weekStart } from "@/lib/stats";
import { addDaysKey, dayKey, formatTime } from "@/lib/tz";
import { outcomeOf, pnlOf, rOf, summarize, type PnlMode } from "@/lib/stats";
import { formatMoney, formatPct, formatPnl, formatR, pnlTone, winLossLabel, formatWinRate } from "@/lib/format";

export default function DailyPage({ searchParams }: PageProps<"/daily">) {
  return (
    <Suspense fallback={<DailySkeleton />}>
      <Daily searchParams={searchParams} />
    </Suspense>
  );
}

const dayHref = (key: string) => `/daily?date=${key}`;

async function Daily({ searchParams }: { searchParams: PageProps<"/daily">["searchParams"] }) {
  const sp = await searchParams;
  const filters = await readFilters(sp);
  const { mode } = filters;
  const requested = typeof sp.date === "string" && parseDay(sp.date) ? sp.date : null;
  const [lastDay, { timezone }, accounts] = await Promise.all([getLastTradeDay(filters), getSettings(), getAccounts()]);
  const key = requested ?? lastDay ?? dayKey(new Date(), timezone);
  const day = parseDay(key)!; // civil date, for labels only

  const [trades, prev, next, entry, shots, open, breaches, review, weekReview] = await Promise.all([
    getClosedTradesInDays(key, addDaysKey(key, 1), filters),
    getAdjacentTradingDay(key, "prev", filters),
    getAdjacentTradingDay(key, "next", filters),
    getJournalEntry(key),
    getScreenshots({ day: key }),
    getOpenTrades(filters, key),
    dayBreaches(key),
    getReview("day", key),
    getReview("week", weekStart(key)),
  ]);

  const title = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <PageHeader title="Daily">
        <div className="flex items-center gap-1">
          <DayNav href={prev ? dayHref(prev) : null} label="Previous trading day">
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </DayNav>
          <span className="w-40 text-center text-[13px] text-foreground">{title}</span>
          <DayNav href={next ? dayHref(next) : null} label="Next trading day">
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </DayNav>
          <Link
            href={`/calendar?month=${monthKey(day)}`}
            aria-label="Open in calendar"
            className="ml-1 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CalendarDays className="size-4" strokeWidth={1.5} />
          </Link>
        </div>
        <FilterBar filters={filters} accounts={accounts} showRange={false} />
      </PageHeader>

      <div className="mx-auto grid max-w-[1400px] gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {breaches.length > 0 && <BreachBanner breaches={breaches} timezone={timezone} />}
          {trades.length ? (
            <DayDetail trades={trades} mode={mode} timezone={timezone} />
          ) : (
            <Panel>
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <h2 className="text-[17px]">No trades on this day</h2>
                <p className="text-muted-foreground">
                  You can still write in your journal. Use the arrows to jump between trading days.
                </p>
              </div>
            </Panel>
          )}
          {open.length > 0 && (
            <Panel title="Still open" meta="Opened this day">
              <ul className="divide-y divide-border">
                {open.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/trades?range=all&trade=${t.id}`}
                      className="flex h-10 items-center gap-3 px-4 text-[13px] transition-colors hover:bg-muted/50"
                    >
                      <span className="num text-muted-foreground">{formatTime(t.openedAt, timezone)}</span>
                      <span className="font-medium">{t.symbol}</span>
                      <span className="text-muted-foreground">
                        {t.side === "long" ? "Long" : "Short"} {t.quantity.toLocaleString("en-US")} @ {t.entryPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                      </span>
                      <span className="ml-auto text-[12px] text-faint">{t.account}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="flex flex-col gap-4 self-start">
          <Panel title="Journal">
            <JournalEditor
              key={key}
              day={key}
              initialContent={entry?.content ?? ""}
              initialFollowedRules={entry?.followedRules ?? null}
            />
          </Panel>
          <Panel
            title="Review"
            meta={
              weekReview ? (
                <Link href={`/reviews#week-${weekReview.startDay}`} className="hover:text-foreground">
                  Week review
                </Link>
              ) : undefined
            }
          >
            {review ? (
              <div className="px-4 pb-4 pt-1">
                <ReviewBody content={review.content} />
              </div>
            ) : (
              <p className="px-4 pb-4 pt-1 text-[13px] text-faint">
                No review yet. In Claude Code, run{" "}
                <code className="num rounded bg-muted px-1 text-[12px] text-muted-foreground">/review-trades day {key}</code>.
              </p>
            )}
          </Panel>
          <Panel
            title="Screenshots"
            meta={
              <Link href={`/screenshots?day=${key}`} className="hover:text-foreground">
                Add
              </Link>
            }
          >
            {shots.length ? (
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2">
                {shots.map((item) => (
                  <ScreenshotThumb key={item.id} item={item} compact />
                ))}
              </div>
            ) : (
              <p className="px-4 pb-4 pt-1 text-[13px] text-faint">
                Paste or drop a chart to annotate this day&apos;s trades.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Limits are checked against everything traded that day, whatever the filter bar shows. */
async function dayBreaches(key: string) {
  const goals = await getGoals();
  if (!goals.some((g) => g.active && isLimit(g))) return [];
  return evaluateDay(await getClosedTradesInDays(key, addDaysKey(key, 1)), goals);
}

function BreachBanner({ breaches, timezone }: { breaches: Breach[]; timezone: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-[10px] border border-loss/30 bg-loss/10 px-4 py-3 text-[13px]">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-loss" strokeWidth={1.5} />
      <ul className="flex flex-1 flex-col gap-0.5">
        {breaches.map((b) => (
          <li key={b.goal.id} className="text-foreground">
            <span className="num text-muted-foreground">{formatTime(b.at, timezone)}</span> · {b.text}
          </li>
        ))}
      </ul>
      <Link href="/goals" className="shrink-0 text-[12px] text-muted-foreground hover:text-foreground">
        Goals
      </Link>
    </div>
  );
}

function DayDetail({ trades, mode, timezone }: { trades: JournalTrade[]; mode: PnlMode; timezone: string }) {
  const s = summarize(trades, mode);
  const volume = trades.reduce((v, t) => v + t.quantity * 2, 0);
  const fees = trades.reduce((v, t) => v + t.fees, 0);
  const gross = trades.reduce((v, t) => v + t.grossPnl, 0);

  const curve = intradayCurve(trades, mode);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label={`${mode === "net" ? "Net" : "Gross"} P&L`}
          value={formatPnl(s.total)}
          tone={pnlTone(s.total)}
          sub={winLossLabel(s)}
        />
        <Kpi label="Win rate" value={formatWinRate(s, 0)} sub={`${s.count} ${s.count === 1 ? "trade" : "trades"}`} />
        <Kpi label="Volume" value={volume.toLocaleString("en-US")} sub="shares / contracts, in and out" />
        <Kpi
          label="Fees"
          value={formatMoney(fees)}
          sub={gross ? `${formatPct(fees / Math.abs(gross), 0)} of gross P&L` : undefined}
        />
      </div>

      <Panel title="Intraday P&L">
        <div className="px-1 pb-2">
          <IntradayChart data={curve} timezone={timezone} />
        </div>
      </Panel>

      <Panel title="Trades" meta={`${trades.length}`}>
        <TradesTable trades={trades} mode={mode} timezone={timezone} />
      </Panel>

      <Panel title="Blotter" meta="By symbol">
        <Blotter trades={trades} />
      </Panel>
    </>
  );
}

/** Running P&L, starting at zero when the first trade opens. */
function intradayCurve(trades: JournalTrade[], mode: PnlMode) {
  const first = trades.reduce((m, t) => Math.min(m, t.openedAt.getTime()), Infinity);
  const points = [{ t: first, equity: 0, pnl: 0, symbol: "" }];
  for (const t of trades) {
    const pnl = pnlOf(t, mode);
    const equity = Math.round((points[points.length - 1].equity + pnl) * 100) / 100;
    points.push({ t: t.closedAt.getTime(), equity, pnl, symbol: t.symbol });
  }
  return points;
}

function duration(a: Date, b: Date) {
  const mins = Math.round((b.getTime() - a.getTime()) / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

const price = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function TradesTable({ trades, mode, timezone }: { trades: JournalTrade[]; mode: PnlMode; timezone: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13px]">
        <thead className="text-[12px] text-faint">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left font-normal">Time</th>
            <th className="px-2 py-2 text-left font-normal">Symbol</th>
            <th className="px-2 py-2 text-left font-normal">Side</th>
            <th className="px-2 py-2 text-right font-normal">Qty</th>
            <th className="px-2 py-2 text-right font-normal">Entry</th>
            <th className="px-2 py-2 text-right font-normal">Exit</th>
            <th className="px-2 py-2 text-right font-normal">P&L</th>
            <th className="px-2 py-2 text-right font-normal">R</th>
            <th className="px-2 py-2 text-left font-normal">Tags</th>
            <th className="px-4 py-2 text-center font-normal">Rules</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const pnl = pnlOf(t, mode);
            return (
              <tr key={t.id} className="h-10 border-b border-border last:border-0 hover:bg-muted/50">
                <td className="num whitespace-nowrap px-4 text-muted-foreground">
                  {formatTime(t.openedAt, timezone)} <span className="text-faint">· {duration(t.openedAt, t.closedAt)}</span>
                </td>
                <td className="px-2 font-medium">{t.symbol}</td>
                <td className="px-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px]",
                      t.side === "long" ? "bg-primary/15 text-primary-text" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.side === "long" ? "Long" : "Short"}
                  </span>
                </td>
                <td className="num px-2 text-right">{t.quantity.toLocaleString("en-US")}</td>
                <td className="num px-2 text-right text-muted-foreground">{price(t.entryPrice)}</td>
                <td className="num px-2 text-right text-muted-foreground">{price(t.exitPrice)}</td>
                <td className={cn("num px-2 text-right", pnlTone(pnl))}>{formatPnl(pnl, true)}</td>
                <td className={cn("num px-2 text-right", t.risk ? pnlTone(pnl) : "text-faint")}>{formatR(rOf(t, mode))}</td>
                <td className="max-w-[14rem] px-2">
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span key={tag} className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    {t.confluences.map((tag) => (
                      <span key={tag} className="truncate rounded border border-input px-1.5 py-px text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 text-center">
                  {t.followedRules === true && <Check className="mx-auto size-3.5 text-profit" strokeWidth={2} aria-label="Followed rules" />}
                  {t.followedRules === false && <X className="mx-auto size-3.5 text-loss" strokeWidth={2} aria-label="Broke rules" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Blotter({ trades }: { trades: JournalTrade[] }) {
  const rows = new Map<string, { trades: number; volume: number; gross: number; fees: number; net: number; wins: number; losses: number }>();
  for (const t of trades) {
    const r = rows.get(t.symbol) ?? { trades: 0, volume: 0, gross: 0, fees: 0, net: 0, wins: 0, losses: 0 };
    r.trades++;
    r.volume += t.quantity * 2;
    r.gross += t.grossPnl;
    r.fees += t.fees;
    r.net += t.netPnl;
    const outcome = outcomeOf(t, "net");
    if (outcome === "win") r.wins++;
    if (outcome === "loss") r.losses++;
    rows.set(t.symbol, r);
  }
  const sorted = [...rows.entries()].sort((a, b) => b[1].net - a[1].net);

  return (
    <table className="w-full text-[13px]">
      <thead className="text-[12px] text-faint">
        <tr className="border-b border-border">
          <th className="px-4 py-2 text-left font-normal">Symbol</th>
          <th className="px-2 py-2 text-right font-normal">Trades</th>
          <th className="px-2 py-2 text-right font-normal">Win rate</th>
          <th className="px-2 py-2 text-right font-normal">Volume</th>
          <th className="px-2 py-2 text-right font-normal">Gross</th>
          <th className="px-2 py-2 text-right font-normal">Fees</th>
          <th className="px-4 py-2 text-right font-normal">Net</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(([symbol, r]) => (
          <tr key={symbol} className="h-10 border-b border-border last:border-0 hover:bg-muted/50">
            <td className="px-4 font-medium">{symbol}</td>
            <td className="num px-2 text-right">{r.trades}</td>
            <td className="num px-2 text-right text-muted-foreground">{r.wins + r.losses ? formatPct(r.wins / (r.wins + r.losses), 0) : "—"}</td>
            <td className="num px-2 text-right text-muted-foreground">{r.volume.toLocaleString("en-US")}</td>
            <td className={cn("num px-2 text-right", pnlTone(r.gross))}>{formatPnl(r.gross, true)}</td>
            <td className="num px-2 text-right text-muted-foreground">{r.fees.toFixed(2)}</td>
            <td className={cn("num px-4 text-right", pnlTone(r.net))}>{formatPnl(r.net, true)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayNav({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "grid size-7 place-items-center rounded-md transition-colors";
  if (!href) {
    return (
      <span aria-label={label} className={cn(cls, "text-faint/40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} aria-label={label} className={cn(cls, "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      {children}
    </Link>
  );
}

function DailySkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto grid max-w-[1400px] gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[520px] animate-pulse rounded-[10px] border border-border bg-card" />
        <div className="h-[320px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
