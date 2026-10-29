import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { PageHeader, Segment, Segmented } from "@/components/shell/page-header";
import { Kpi, Panel } from "@/components/dashboard/card";
import { IntradayChart } from "@/components/daily/intraday-chart";
import { JournalEditor } from "@/components/daily/journal-editor";
import { cn } from "@/lib/utils";
import { addDays, dayKey, monthKey, parseDay } from "@/lib/dates";
import {
  getAdjacentTradingDay,
  getClosedTradesBetween,
  getJournalEntry,
  getLastTradeDate,
  type JournalTrade,
} from "@/lib/queries";
import { pnlOf, summarize, type PnlMode } from "@/lib/stats";
import { formatMoney, formatPct, formatPnl, pnlTone } from "@/lib/format";

export default function DailyPage({ searchParams }: PageProps<"/daily">) {
  return (
    <Suspense fallback={<DailySkeleton />}>
      <Daily searchParams={searchParams} />
    </Suspense>
  );
}

const dayHref = (d: Date, mode: PnlMode) =>
  `/daily?date=${dayKey(d)}${mode === "gross" ? "&mode=gross" : ""}`;

async function Daily({ searchParams }: { searchParams: PageProps<"/daily">["searchParams"] }) {
  const sp = await searchParams;
  const mode: PnlMode = sp.mode === "gross" ? "gross" : "net";
  const requested = parseDay(typeof sp.date === "string" ? sp.date : undefined);
  const last = await getLastTradeDate();
  const day = requested ?? (last ? new Date(last.getFullYear(), last.getMonth(), last.getDate()) : new Date());
  const key = dayKey(day);

  const [trades, prev, next, entry] = await Promise.all([
    getClosedTradesBetween(day, addDays(day, 1)),
    getAdjacentTradingDay(day, "prev"),
    getAdjacentTradingDay(day, "next"),
    getJournalEntry(key),
  ]);

  const title = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <PageHeader title="Daily">
        <div className="flex items-center gap-1">
          <DayNav href={prev ? dayHref(prev, mode) : null} label="Previous trading day">
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </DayNav>
          <span className="w-40 text-center text-[13px] text-foreground">{title}</span>
          <DayNav href={next ? dayHref(next, mode) : null} label="Next trading day">
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
        <Segmented>
          <Segment href={`/daily?date=${key}`} active={mode === "net"}>Net</Segment>
          <Segment href={`/daily?date=${key}&mode=gross`} active={mode === "gross"}>Gross</Segment>
        </Segmented>
      </PageHeader>

      <div className="mx-auto grid max-w-[1400px] gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {trades.length ? (
            <DayDetail trades={trades} mode={mode} />
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
        </div>
        <Panel title="Journal" className="self-start">
          <JournalEditor
            key={key}
            day={key}
            initialContent={entry?.content ?? ""}
            initialFollowedRules={entry?.followedRules ?? null}
          />
        </Panel>
      </div>
    </>
  );
}

function DayDetail({ trades, mode }: { trades: JournalTrade[]; mode: PnlMode }) {
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
          sub={`${s.wins}W · ${s.losses}L`}
        />
        <Kpi label="Win rate" value={formatPct(s.winRate, 0)} sub={`${s.count} trades`} />
        <Kpi label="Volume" value={volume.toLocaleString()} sub="shares / contracts, in and out" />
        <Kpi
          label="Fees"
          value={formatMoney(fees)}
          sub={gross ? `${formatPct(fees / Math.abs(gross), 0)} of gross P&L` : undefined}
        />
      </div>

      <Panel title="Intraday P&L">
        <div className="px-1 pb-2">
          <IntradayChart data={curve} />
        </div>
      </Panel>

      <Panel title="Trades" meta={`${trades.length}`}>
        <TradesTable trades={trades} mode={mode} />
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

const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

function duration(a: Date, b: Date) {
  const mins = Math.round((b.getTime() - a.getTime()) / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

const price = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function TradesTable({ trades, mode }: { trades: JournalTrade[]; mode: PnlMode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead className="text-[12px] text-faint">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left font-normal">Time</th>
            <th className="px-2 py-2 text-left font-normal">Symbol</th>
            <th className="px-2 py-2 text-left font-normal">Side</th>
            <th className="px-2 py-2 text-right font-normal">Qty</th>
            <th className="px-2 py-2 text-right font-normal">Entry</th>
            <th className="px-2 py-2 text-right font-normal">Exit</th>
            <th className="px-2 py-2 text-right font-normal">P&L</th>
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
                  {clock(t.openedAt)} <span className="text-faint">· {duration(t.openedAt, t.closedAt)}</span>
                </td>
                <td className="px-2 font-medium">{t.symbol}</td>
                <td className="px-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px]",
                      t.side === "long" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.side === "long" ? "Long" : "Short"}
                  </span>
                </td>
                <td className="num px-2 text-right">{t.quantity.toLocaleString()}</td>
                <td className="num px-2 text-right text-muted-foreground">{price(t.entryPrice)}</td>
                <td className="num px-2 text-right text-muted-foreground">{price(t.exitPrice)}</td>
                <td className={cn("num px-2 text-right", pnlTone(pnl))}>{formatPnl(pnl, true)}</td>
                <td className="max-w-[14rem] px-2">
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span key={tag} className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
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
  const rows = new Map<string, { trades: number; volume: number; gross: number; fees: number; net: number; wins: number }>();
  for (const t of trades) {
    const r = rows.get(t.symbol) ?? { trades: 0, volume: 0, gross: 0, fees: 0, net: 0, wins: 0 };
    r.trades++;
    r.volume += t.quantity * 2;
    r.gross += t.grossPnl;
    r.fees += t.fees;
    r.net += t.netPnl;
    if (t.netPnl > 0) r.wins++;
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
            <td className="num px-2 text-right text-muted-foreground">{formatPct(r.wins / r.trades, 0)}</td>
            <td className="num px-2 text-right text-muted-foreground">{r.volume.toLocaleString()}</td>
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
      <div className="mx-auto grid max-w-[1400px] gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[520px] animate-pulse rounded-[10px] border border-border bg-card" />
        <div className="h-[320px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
