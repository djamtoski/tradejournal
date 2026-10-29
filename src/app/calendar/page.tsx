import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Segment, Segmented } from "@/components/shell/page-header";
import { FilterBar } from "@/components/shell/filter-bar";
import { readFilters } from "@/lib/filters-server";
import { Panel } from "@/components/dashboard/card";
import { pnlTint } from "@/components/calendar/tint";
import { cn } from "@/lib/utils";
import { addMonths, civilKey, monthKey, monthLabel, monthWeeks, parseDay, parseMonth } from "@/lib/dates";
import { getAccounts, getClosedTradesInDays, getLastTradeDay } from "@/lib/queries";
import { getSettings } from "@/lib/settings/queries";
import { dayKey } from "@/lib/tz";
import { dailySeries, summarize } from "@/lib/stats";
import { formatPct, formatPnl, pnlTone } from "@/lib/format";

type View = "month" | "year";
type State = { month: Date; view: View };

function href({ month, view }: State) {
  const params = new URLSearchParams({ month: monthKey(month) });
  if (view === "year") params.set("view", "year");
  return `/calendar?${params}`;
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const sp = await searchParams;
  const filters = await readFilters(sp);
  const { mode } = filters;
  const [lastDay, { timezone }, accounts] = await Promise.all([getLastTradeDay(filters), getSettings(), getAccounts()]);
  const today = dayKey(new Date(), timezone);
  const last = parseDay(lastDay ?? today)!;
  const state: State = {
    month: parseMonth(typeof sp.month === "string" ? sp.month : undefined, last),
    view: sp.view === "year" ? "year" : "month",
  };
  const { month, view } = state;

  const start = view === "year" ? new Date(month.getFullYear(), 0, 1) : month;
  const end = view === "year" ? new Date(month.getFullYear() + 1, 0, 1) : addMonths(month, 1);
  const trades = await getClosedTradesInDays(civilKey(start), civilKey(end), filters);
  const days = new Map(dailySeries(trades, mode).map((d) => [d.day, d]));
  const summary = summarize(trades, mode);

  const step = view === "year" ? 12 : 1;
  const title = view === "year" ? String(month.getFullYear()) : monthLabel(month);

  return (
    <>
      <PageHeader title="Calendar">
        <div className="flex items-center gap-1">
          <NavButton href={href({ ...state, month: addMonths(month, -step) })} label="Previous">
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </NavButton>
          <span className="w-32 text-center text-[13px] text-foreground">{title}</span>
          <NavButton href={href({ ...state, month: addMonths(month, step) })} label="Next">
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </NavButton>
        </div>
        <Segmented>
          <Segment href={href({ ...state, view: "month" })} active={view === "month"}>Month</Segment>
          <Segment href={href({ ...state, view: "year" })} active={view === "year"}>Year</Segment>
        </Segmented>
        <FilterBar filters={filters} accounts={accounts} showRange={false} />
      </PageHeader>

      <div className="mx-auto grid max-w-[1400px] gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        {view === "month" ? (
          <MonthGrid month={month} days={days} today={today} />
        ) : (
          <YearGrid year={month.getFullYear()} days={days} state={state} />
        )}
        <Summary summary={summary} label={title} />
      </div>
    </>
  );
}

type DayMap = Map<string, { day: string; pnl: number; trades: number }>;

function MonthGrid({ month, days, today }: { month: Date; days: DayMap; today: string }) {
  const weeks = monthWeeks(month);
  const max = Math.max(0, ...[...days.values()].map((d) => Math.abs(d.pnl)));

  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)] border-b border-border text-[12px] text-faint">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Week"].map((d) => (
          <div key={d} className={cn("px-3 py-2", d === "Week" && "text-right")}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const weekDays = week.filter(Boolean).map((d) => days.get(civilKey(d!))).filter(Boolean);
        const weekPnl = weekDays.reduce((s, d) => s + d!.pnl, 0);
        const weekTrades = weekDays.reduce((s, d) => s + d!.trades, 0);
        return (
          <div
            key={wi}
            className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)] border-b border-border last:border-0"
          >
            {week.map((date, di) => {
              if (!date) return <div key={di} className="h-24 border-r border-border bg-background/40" />;
              const key = civilKey(date);
              const d = days.get(key);
              const cell = (
                <>
                  <span className={cn("num text-[12px]", key === today ? "text-primary" : "text-faint")}>
                    {date.getDate()}
                  </span>
                  {d && (
                    <span className="mt-auto flex flex-col items-end">
                      <span className={cn("num text-[14px]", pnlTone(d.pnl))}>{formatPnl(d.pnl)}</span>
                      <span className="num text-[11px] text-faint">
                        {d.trades} {d.trades === 1 ? "trade" : "trades"}
                      </span>
                    </span>
                  )}
                </>
              );
              const base = "flex h-24 flex-col border-r border-border p-2.5 transition-colors";
              return d ? (
                <Link
                  key={di}
                  href={`/daily?date=${key}`}
                  className={cn(base, "hover:shadow-[inset_0_0_0_1px_var(--input)]")}
                  style={pnlTint(d.pnl, max)}
                >
                  {cell}
                </Link>
              ) : (
                <div key={di} className={base}>{cell}</div>
              );
            })}
            <div className="flex h-24 flex-col items-end justify-end bg-background/40 p-2.5">
              {weekTrades > 0 && (
                <>
                  <span className={cn("num text-[14px]", pnlTone(weekPnl))}>{formatPnl(weekPnl)}</span>
                  <span className="num text-[11px] text-faint">{weekDays.length}d · {weekTrades}t</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

function YearGrid({ year, days, state }: { year: number; days: DayMap; state: State }) {
  const max = Math.max(0, ...[...days.values()].map((d) => Math.abs(d.pnl)));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const month = new Date(year, m, 1);
        const inMonth = [...days.values()].filter((d) => d.day.startsWith(monthKey(month)));
        const pnl = inMonth.reduce((s, d) => s + d.pnl, 0);
        return (
          <Link
            key={m}
            href={href({ ...state, month, view: "month" })}
            className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-input"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-foreground">{monthLabel(month, { month: "long" })}</span>
              <span className={cn("num text-[13px]", inMonth.length ? pnlTone(pnl) : "text-faint")}>
                {inMonth.length ? formatPnl(pnl) : "—"}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthWeeks(month).flat().map((date, i) => {
                const d = date ? days.get(civilKey(date)) : undefined;
                return (
                  <span
                    key={i}
                    title={d ? `${civilKey(date!)} · ${formatPnl(d.pnl)}` : undefined}
                    className={cn("aspect-square rounded-[3px]", date ? "bg-muted" : "bg-transparent")}
                    style={d ? pnlTint(d.pnl, max) : undefined}
                  />
                );
              })}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Summary({ summary: s, label }: { summary: ReturnType<typeof summarize>; label: string }) {
  const rows: [string, string, string?][] = [
    ["Trading days", String(s.tradingDays)],
    ["Green days", s.tradingDays ? `${s.greenDays} · ${formatPct(s.greenDays / s.tradingDays, 0)}` : "—"],
    ["Win rate", s.count ? formatPct(s.winRate) : "—"],
    ["Trades", String(s.count)],
    ["Avg day", s.tradingDays ? formatPnl(s.total / s.tradingDays) : "—", s.tradingDays ? pnlTone(s.total) : undefined],
    ["Best day", s.bestDay ? formatPnl(s.bestDay.pnl) : "—", s.bestDay ? pnlTone(s.bestDay.pnl) : undefined],
    ["Worst day", s.worstDay ? formatPnl(s.worstDay.pnl) : "—", s.worstDay ? pnlTone(s.worstDay.pnl) : undefined],
  ];
  return (
    <Panel className="self-start">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3.5">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className={cn("num text-[24px] leading-none", pnlTone(s.total))}>{formatPnl(s.total)}</span>
      </div>
      <dl className="px-4 py-1 text-[13px]">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex h-9 items-center justify-between border-b border-border last:border-0">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={cn("num", tone ?? "text-foreground")}>{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function NavButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function CalendarSkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto max-w-[1400px] p-6">
        <div className="h-[560px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
