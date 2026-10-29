import { Suspense } from "react";
import { connection } from "next/server";
import { asc, count } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/dashboard/card";
import { AccountsSection, DangerZone, TagsSection } from "@/components/settings/sections";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 p-6">
        <Suspense fallback={<div className="h-[400px] animate-pulse rounded-[10px] border border-border bg-card" />}>
          <Settings />
        </Suspense>
      </div>
    </>
  );
}

async function Settings() {
  await connection();
  const [accounts, tradeCounts, importCounts, groups, tags, tagUses, totals] = await Promise.all([
    db.select().from(schema.accounts).orderBy(asc(schema.accounts.name)),
    db.select({ id: schema.trades.accountId, n: count() }).from(schema.trades).groupBy(schema.trades.accountId),
    db.select({ id: schema.imports.accountId, n: count() }).from(schema.imports).groupBy(schema.imports.accountId),
    db.select({ id: schema.tagGroups.id, name: schema.tagGroups.name }).from(schema.tagGroups).orderBy(asc(schema.tagGroups.name)),
    db.select().from(schema.tags).orderBy(asc(schema.tags.name)),
    db.select({ id: schema.tradeTags.tagId, n: count() }).from(schema.tradeTags).groupBy(schema.tradeTags.tagId),
    Promise.all([
      db.select({ n: count() }).from(schema.trades),
      db.select({ n: count() }).from(schema.journalEntries),
      db.select({ n: count() }).from(schema.playbooks),
    ]),
  ]);
  const by = (rows: { id: number; n: number }[]) => new Map(rows.map((r) => [r.id, r.n]));
  const trades = by(tradeCounts);
  const imports = by(importCounts);
  const uses = by(tagUses);
  const [[{ n: tradeTotal }], [{ n: journalTotal }], [{ n: playbookTotal }]] = totals;

  return (
    <>
      <Section title="Accounts" description="Rename accounts or delete one with all of its trades and imports.">
        <AccountsSection
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            broker: a.broker,
            trades: trades.get(a.id) ?? 0,
            imports: imports.get(a.id) ?? 0,
          }))}
        />
      </Section>

      <Section title="Tags" description="Organise setups and mistakes. The number is how many trades use each tag.">
        <TagsSection
          groups={groups}
          tags={tags.map((t) => ({ id: t.id, name: t.name, groupId: t.groupId, uses: uses.get(t.id) ?? 0 }))}
        />
      </Section>

      <Section title="Your data" description="Everything is stored in data/journal.db on this computer. Nothing is sent anywhere.">
        <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
          <p className="num text-[12px] text-faint">
            {tradeTotal.toLocaleString()} trades · {journalTotal} journal entries · {playbookTotal} playbook entries
          </p>
          <div className="flex flex-wrap gap-2">
            <DownloadLink href="/api/export/trades">Export trades (CSV)</DownloadLink>
            <DownloadLink href="/api/export/backup">Download full backup (JSON)</DownloadLink>
          </div>
          <p className="text-[12px] text-faint">
            The CSV opens in any spreadsheet. The backup has every table; screenshot images stay in
            data/screenshots, so copy that folder too when moving computers.
          </p>
        </div>
      </Section>

      <Section title="Danger zone">
        <DangerZone />
      </Section>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="px-4 pb-2 pt-3.5">
        <h2 className="font-sans text-[14px] font-medium tracking-normal text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-faint">{description}</p>}
      </div>
      {children}
    </Panel>
  );
}

function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      download
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-[13px] text-foreground transition-colors hover:bg-muted"
    >
      <Download className="size-3.5" strokeWidth={1.5} /> {children}
    </a>
  );
}
