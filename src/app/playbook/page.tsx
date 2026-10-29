import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { ArrowUpRight, Plus } from "lucide-react";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/shell/page-header";
import { Kpi, Panel } from "@/components/dashboard/card";
import { PlaybookEditor } from "@/components/playbook/playbook-editor";
import { cn } from "@/lib/utils";
import { createPlaybook } from "@/lib/playbook/actions";
import { getAllTags, getClosedTradesBetween, isMistakeGroup } from "@/lib/queries";
import { summarize } from "@/lib/stats";
import { formatPct, formatPnl, formatRatio, pnlTone } from "@/lib/format";

export default function PlaybookPage({ searchParams }: PageProps<"/playbook">) {
  return (
    <>
      <PageHeader title="Playbook">
        <form action={createPlaybook}>
          <button
            type="submit"
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" strokeWidth={2} /> New entry
          </button>
        </form>
      </PageHeader>
      <Suspense fallback={<PlaybookSkeleton />}>
        <Playbook searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Playbook({ searchParams }: { searchParams: PageProps<"/playbook">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const [entries, tags] = await Promise.all([
    db.select().from(schema.playbooks).orderBy(desc(schema.playbooks.updatedAt)),
    getAllTags(),
  ]);
  const requested = Number(typeof sp.id === "string" ? sp.id : NaN);
  const selected = entries.find((e) => e.id === requested) ?? entries[0];
  const tagName = (id: number | null) => tags.find((t) => t.id === id)?.name;
  const setupTags = tags.filter((t) => !isMistakeGroup(t.group)).map((t) => ({ id: t.id, name: t.name }));

  if (!selected) {
    return (
      <div className="mx-auto max-w-[1200px] p-6">
        <Panel>
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <h2 className="text-[17px]">Write your first setup</h2>
            <p className="max-w-sm text-muted-foreground">
              Describe when you take a trade, where your stop goes and when you skip it. Link it to a
              tag to track how the setup performs.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] items-start gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 lg:sticky lg:top-16">
        {entries.map((e) => (
          <Link
            key={e.id}
            href={`/playbook?id=${e.id}`}
            scroll={false}
            className={cn(
              "flex flex-col gap-0.5 rounded-md px-3 py-2 transition-colors",
              e.id === selected.id ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <span className={cn("truncate text-[13px]", e.id === selected.id ? "text-foreground" : "text-muted-foreground")}>
              {e.title}
            </span>
            <span className="truncate text-[11px] text-faint">
              {tagName(e.tagId) ?? "Not linked"} ·{" "}
              {e.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {selected.tagId && tagName(selected.tagId) && (
          <Suspense key={selected.tagId} fallback={<div className="h-[92px] animate-pulse rounded-[10px] border border-border bg-card" />}>
            <SetupStats tag={tagName(selected.tagId)!} />
          </Suspense>
        )}
        <PlaybookEditor
          key={selected.id}
          id={selected.id}
          initialTitle={selected.title}
          initialContent={selected.content}
          initialTagId={selected.tagId}
          setupTags={setupTags}
        />
      </div>
    </div>
  );
}

/** All-time and last-30-day results for trades tagged with this setup. */
async function SetupStats({ tag }: { tag: string }) {
  const all = (await getClosedTradesBetween(null, null)).filter((t) => t.tags.includes(tag));
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recent = all.filter((t) => t.closedAt >= since);
  const s = summarize(all, "net");
  const r = summarize(recent, "net");

  if (!all.length) {
    return (
      <p className="rounded-[10px] border border-border bg-card px-4 py-3 text-[13px] text-faint">
        No trades tagged “{tag}” yet. Tag trades on the Trades page to see how this setup performs.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Net P&L" value={formatPnl(s.total)} tone={pnlTone(s.total)} sub={`${s.count} trades, all time`} />
        <Kpi label="Win rate" value={formatPct(s.winRate, 0)} sub={`${s.wins}W · ${s.losses}L`} />
        <Kpi label="Profit factor" value={formatRatio(s.profitFactor)} sub={`expectancy ${formatPnl(s.expectancy)}`} />
        <Kpi
          label="Last 30 days"
          value={r.count ? formatPnl(r.total) : "—"}
          tone={r.count ? pnlTone(r.total) : undefined}
          sub={r.count ? `${r.count} trades · ${formatPct(r.winRate, 0)}` : "no trades"}
        />
      </div>
      <Link
        href={`/trades?range=all&tag=${encodeURIComponent(tag)}`}
        className="flex w-fit items-center gap-1 text-[12px] text-faint transition-colors hover:text-foreground"
      >
        View {s.count} trades <ArrowUpRight className="size-3" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function PlaybookSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="h-[200px] animate-pulse rounded-[10px] bg-card" />
      <div className="h-[500px] animate-pulse rounded-[10px] border border-border bg-card" />
    </div>
  );
}
