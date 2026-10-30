import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { FilterBar } from "@/components/shell/filter-bar";
import { readFilters } from "@/lib/filters-server";
import { Panel } from "@/components/dashboard/card";
import { FilterRow } from "@/components/trades/filter-row";
import { TradeEditor } from "@/components/trades/trade-editor";
import { ScreenshotThumb } from "@/components/screenshots/thumb";
import { getScreenshots } from "@/lib/screenshots/queries";
import { parseDay } from "@/lib/dates";
import { getSettings } from "@/lib/settings/queries";
import { dayKey, formatDateTime, formatTime } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { getAccounts, getAllTags, getClosedTrades, getTagGroups, getTradeDetail } from "@/lib/queries";
import { applyTradeFilters, parseTradeFilters, tradesHref, type SortKey, type TradeFilters } from "@/lib/trades/filters";
import { pnlOf, summarize } from "@/lib/stats";
import { formatPct, formatPnl, pnlTone } from "@/lib/format";

const PAGE_SIZE = 100;

export default function TradesPage({ searchParams }: PageProps<"/trades">) {
  return (
    <Suspense fallback={<TradesSkeleton />}>
      <Trades searchParams={searchParams} />
    </Suspense>
  );
}

async function Trades({ searchParams }: { searchParams: PageProps<"/trades">["searchParams"] }) {
  const sp = await searchParams;
  const shared = await readFilters(sp);
  const f = parseTradeFilters(sp, shared.mode);
  const [all, tags, { timezone }, accounts] = await Promise.all([
    getClosedTrades(shared.range, shared),
    getAllTags(),
    getSettings(),
    getAccounts(),
  ]);
  const trades = applyTradeFilters(all, f);
  const s = summarize(trades, f.mode);
  const pages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const visible = trades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader title="Trades">
        <FilterBar filters={shared} accounts={accounts} />
      </PageHeader>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterRow filters={f} tags={tags.map((t) => ({ name: t.name, group: t.group }))} />
          <p className="num text-[12px] text-faint">
            {trades.length.toLocaleString()} trades ·{" "}
            <span className={pnlTone(s.total)}>{formatPnl(s.total)}</span> · {formatPct(s.winRate, 0)} win rate
          </p>
        </div>

        <div className={cn("grid items-start gap-4", f.trade && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
          <Panel className="overflow-hidden">
            {visible.length ? (
              <TradeTable trades={visible} f={f} timezone={timezone} />
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <h2 className="text-[17px]">No trades match these filters</h2>
                <Link href={tradesHref(f, { q: "", side: "", result: "", tag: "", rules: "", page: 1 })} className="text-[13px] text-muted-foreground hover:text-foreground">
                  Clear filters
                </Link>
              </div>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[12px] text-faint">
                <span className="num">Page {page} of {pages}</span>
                <div className="flex gap-1">
                  {page > 1 && <Link className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground" href={tradesHref(f, { page: page - 1 })}>Previous</Link>}
                  {page < pages && <Link className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground" href={tradesHref(f, { page: page + 1 })}>Next</Link>}
                </div>
              </div>
            )}
          </Panel>

          {f.trade && (
            <Suspense key={f.trade} fallback={<div className="h-[600px] animate-pulse rounded-[10px] border border-border bg-card" />}>
              <TradeDetail id={f.trade} f={f} timezone={timezone} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}

const columns: { key: SortKey | null; label: string; align?: "right" }[] = [
  { key: "date", label: "Date" },
  { key: "duration", label: "Hold" },
  { key: "symbol", label: "Symbol" },
  { key: null, label: "Side" },
  { key: "qty", label: "Qty", align: "right" },
  { key: null, label: "Entry", align: "right" },
  { key: null, label: "Exit", align: "right" },
  { key: "pnl", label: "P&L", align: "right" },
  { key: null, label: "Tags" },
  { key: null, label: "Rules" },
];

const price = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function hold(a: Date, b: Date) {
  const mins = Math.round((b.getTime() - a.getTime()) / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
  return `${Math.floor(mins / 1440)}d`;
}

function TradeTable({
  trades,
  f,
  timezone,
}: {
  trades: Awaited<ReturnType<typeof getClosedTrades>>;
  f: TradeFilters;
  timezone: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead className="text-[12px] text-faint">
          <tr className="border-b border-border">
            {columns.map((c, i) => {
              const sorted = c.key && f.sort === c.key;
              const nextDir = sorted && f.dir === "desc" ? "asc" : "desc";
              return (
                <th
                  key={c.label}
                  className={cn("py-2 font-normal", i === 0 ? "pl-4 pr-2" : "px-2", c.align === "right" ? "text-right" : "text-left")}
                >
                  {c.key ? (
                    <Link
                      href={tradesHref(f, { sort: c.key, dir: nextDir, page: 1 })}
                      scroll={false}
                      className={cn("inline-flex items-center gap-1 hover:text-foreground", sorted && "text-foreground")}
                    >
                      {c.label}
                      {sorted && (f.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const pnl = pnlOf(t, f.mode);
            const selected = f.trade === t.id;
            return (
              <tr
                key={t.id}
                className={cn(
                  "relative h-10 border-b border-border last:border-0 transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <td className="num whitespace-nowrap pl-4 pr-2 text-muted-foreground">
                  <Link
                    href={tradesHref(f, { trade: selected ? null : t.id })}
                    scroll={false}
                    className="after:absolute after:inset-0"
                    aria-label={`${t.symbol} ${t.side} on ${t.openedAt.toDateString()}`}
                  >
                    {parseDay(t.day)!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    <span className="text-faint">{formatTime(t.openedAt, timezone)}</span>
                  </Link>
                </td>
                <td className="num px-2 text-faint">{hold(t.openedAt, t.closedAt)}</td>
                <td className="px-2 font-medium">{t.symbol}</td>
                <td className="px-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[11px]", t.side === "long" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                    {t.side === "long" ? "Long" : "Short"}
                  </span>
                </td>
                <td className="num px-2 text-right">{t.quantity.toLocaleString()}</td>
                <td className="num px-2 text-right text-muted-foreground">{price(t.entryPrice)}</td>
                <td className="num px-2 text-right text-muted-foreground">{price(t.exitPrice)}</td>
                <td className={cn("num px-2 text-right", pnlTone(pnl))}>{formatPnl(pnl, true)}</td>
                <td className="max-w-[16rem] px-2">
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span key={tag} className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                    ))}
                    {t.mistakes.map((tag) => (
                      <span key={tag} className="truncate rounded bg-loss/10 px-1.5 py-0.5 text-[11px] text-loss">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-2 pr-4 text-center">
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

async function TradeDetail({ id, f, timezone }: { id: number; f: TradeFilters; timezone: string }) {
  const [detail, allTags, groups, shots] = await Promise.all([
    getTradeDetail(id),
    getAllTags(),
    getTagGroups(),
    getScreenshots({ tradeId: id }),
  ]);
  if (!detail) {
    return (
      <Panel className="p-4 text-[13px] text-muted-foreground">
        That trade no longer exists. <Link href={tradesHref(f, { trade: null })} className="text-foreground hover:underline">Close</Link>
      </Panel>
    );
  }
  const { trade: t, fills } = detail;
  const pnl = f.mode === "net" ? t.netPnl : t.grossPnl;
  const facts: [string, string][] = [
    ["Entry", price(t.entryPrice)],
    ["Exit", price(t.exitPrice)],
    ["Quantity", t.quantity.toLocaleString()],
    ["Hold", t.closedAt ? hold(t.openedAt, t.closedAt) : "Open"],
    ["Gross", formatPnl(t.grossPnl, true)],
    ["Fees", t.fees.toFixed(2)],
  ];

  return (
    <Panel className="sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto">
      <div className="flex items-start justify-between border-b border-border px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-[16px] font-semibold tracking-tight">{t.symbol}</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[11px]", t.side === "long" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
              {t.side === "long" ? "Long" : "Short"}
            </span>
          </div>
          <span className="num text-[12px] text-faint">
            {formatDateTime(t.openedAt, timezone, { weekday: "short" })}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className={cn("num text-[20px] leading-none", pnlTone(pnl))}>{formatPnl(pnl, true)}</span>
          <Link
            href={tradesHref(f, { trade: null })}
            scroll={false}
            aria-label="Close trade details"
            className="grid size-6 place-items-center rounded-md text-faint hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-px border-b border-border bg-border">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 bg-card px-4 py-2.5">
            <dt className="text-[11px] text-faint">{k}</dt>
            <dd className="num text-[13px]">{v}</dd>
          </div>
        ))}
      </dl>

      <TradeEditor
        key={t.id}
        tradeId={t.id}
        side={t.side}
        entryPrice={t.entryPrice}
        quantity={t.quantity}
        multiplier={t.multiplier}
        allTags={allTags}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        initial={{
          tagIds: detail.tagIds,
          note: t.note ?? "",
          followedRules: t.followedRules,
          mfe: t.mfe,
          mae: t.mae,
          stopPrice: t.stopPrice,
          targetPrice: t.targetPrice,
        }}
      />

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">Screenshots</span>
          <Link
            href={`/screenshots?day=${dayKey(t.closedAt ?? t.openedAt, timezone)}&trade=${t.id}`}
            className="text-[12px] text-faint hover:text-foreground"
          >
            Add
          </Link>
        </div>
        {shots.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {shots.map((item) => (
              <ScreenshotThumb key={item.id} item={item} compact />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-faint">No charts attached yet.</p>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <span className="text-[12px] text-muted-foreground">Fills</span>
        {fills.length ? (
          <table className="mt-2 w-full text-[12px]">
            <tbody>
              {fills.map((x) => (
                <tr key={x.id} className="h-7">
                  <td className="num text-faint">
                    {formatTime(x.executedAt, timezone, true)}
                  </td>
                  <td className={x.action === "buy" ? "text-foreground" : "text-muted-foreground"}>{x.action === "buy" ? "Buy" : "Sell"}</td>
                  <td className="num text-right">{x.quantity.toLocaleString()}</td>
                  <td className="num text-right text-muted-foreground">{price(x.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-1 text-[12px] text-faint">Entered manually, no fills recorded.</p>
        )}
      </div>
    </Panel>
  );
}

function TradesSkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto max-w-[1500px] p-6">
        <div className="h-[600px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
