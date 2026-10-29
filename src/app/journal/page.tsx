import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { Check, PenLine, X } from "lucide-react";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/shell/page-header";
import { Kpi, Panel } from "@/components/dashboard/card";
import { JournalSearch } from "@/components/journal/journal-search";
import { cn } from "@/lib/utils";
import { dayKey, parseDay } from "@/lib/dates";
import { getClosedTradesBetween } from "@/lib/queries";
import { dailySeries } from "@/lib/stats";
import { formatPct, formatPnl, pnlTone } from "@/lib/format";

export default function JournalPage({ searchParams }: PageProps<"/journal">) {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <Journal searchParams={searchParams} />
    </Suspense>
  );
}

async function Journal({ searchParams }: { searchParams: PageProps<"/journal">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  await connection();

  const [entries, trades] = await Promise.all([
    db.select().from(schema.journalEntries).orderBy(desc(schema.journalEntries.day)),
    getClosedTradesBetween(null, null),
  ]);
  const days = new Map(dailySeries(trades, "net").map((d) => [d.day, d]));
  const written = entries.filter((e) => e.content.trim() || e.followedRules !== null);
  const shown = q
    ? written.filter((e) => e.content.toLowerCase().includes(q.toLowerCase()))
    : written;

  // Do rule-following days actually pay? Compare average P&L of rated trading days.
  const rated = written.filter((e) => e.followedRules !== null && days.has(e.day));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const followed = rated.filter((e) => e.followedRules).map((e) => days.get(e.day)!.pnl);
  const broke = rated.filter((e) => !e.followedRules).map((e) => days.get(e.day)!.pnl);
  const avgFollowed = avg(followed);
  const avgBroke = avg(broke);
  const coverage = days.size ? written.filter((e) => days.has(e.day)).length / days.size : 0;

  const today = dayKey(new Date());

  return (
    <>
      <PageHeader title="Journal">
        <Link
          href={`/daily?date=${today}`}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PenLine className="size-3.5" strokeWidth={1.75} /> Write today&apos;s entry
        </Link>
      </PageHeader>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Entries" value={written.length.toLocaleString()} sub={`${formatPct(coverage, 0)} of trading days`} />
          <Kpi
            label="Followed rules"
            value={rated.length ? formatPct(followed.length / rated.length, 0) : "—"}
            sub={`${rated.length} rated days`}
          />
          <Kpi
            label="Avg day, rules followed"
            value={avgFollowed === null ? "—" : formatPnl(avgFollowed)}
            tone={avgFollowed === null ? undefined : pnlTone(avgFollowed)}
            sub={`${followed.length} days`}
          />
          <Kpi
            label="Avg day, rules broken"
            value={avgBroke === null ? "—" : formatPnl(avgBroke)}
            tone={avgBroke === null ? undefined : pnlTone(avgBroke)}
            sub={avgFollowed !== null && avgBroke !== null ? `${formatPnl(avgFollowed - avgBroke)} difference` : `${broke.length} days`}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <JournalSearch initial={q} />
          {q && (
            <span className="num text-[12px] text-faint">
              {shown.length} of {written.length} entries
            </span>
          )}
        </div>

        {shown.length ? (
          <div className="flex flex-col gap-2">
            {shown.map((e) => {
              const d = days.get(e.day);
              const date = parseDay(e.day)!;
              return (
                <Link
                  key={e.id}
                  href={`/daily?date=${e.day}`}
                  className="group grid grid-cols-[7.5rem_minmax(0,1fr)_auto] gap-4 rounded-[10px] border border-border bg-card px-4 py-3.5 transition-colors hover:border-input"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] text-foreground">
                      {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[12px] text-faint">
                      {date.toLocaleDateString("en-US", { weekday: "long" })}
                    </span>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
                    {e.content.trim() ? <Highlight text={e.content} q={q} /> : <span className="text-faint">Rated only, no notes.</span>}
                  </p>
                  <div className="flex flex-col items-end gap-1">
                    {d ? (
                      <span className={cn("num text-[13px]", pnlTone(d.pnl))}>{formatPnl(d.pnl)}</span>
                    ) : (
                      <span className="text-[12px] text-faint">No trades</span>
                    )}
                    {e.followedRules === true && (
                      <span className="flex items-center gap-1 text-[11px] text-profit">
                        <Check className="size-3" strokeWidth={2} /> Rules
                      </span>
                    )}
                    {e.followedRules === false && (
                      <span className="flex items-center gap-1 text-[11px] text-loss">
                        <X className="size-3" strokeWidth={2} /> Rules
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Panel>
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <h2 className="text-[17px]">{q ? "No entries match" : "Start your journal"}</h2>
              <p className="max-w-sm text-muted-foreground">
                {q
                  ? "Try a different word."
                  : "Write a few lines after each session. Over time you'll see whether following your rules pays."}
              </p>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-primary/25 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function JournalSkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-6">
        <div className="h-[92px] animate-pulse rounded-[10px] border border-border bg-card" />
        <div className="h-[400px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
