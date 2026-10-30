import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/dashboard/card";
import { ImportWizard } from "@/components/import/import-wizard";
import { ImportHistory } from "@/components/import/import-history";
import { getSettings } from "@/lib/settings/queries";
import { InboxSync } from "@/components/import/inbox-sync";
import { inboxStatus } from "@/lib/import/inbox";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import" />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 p-4 md:p-6">
        <Suspense fallback={<div className="h-[300px] animate-pulse rounded-[10px] border border-border bg-card" />}>
          <ImportContent />
        </Suspense>
      </div>
    </>
  );
}

async function ImportContent() {
  await connection();
  const [accounts, imports, { timezone, inboxFolder, inboxAccountId }] = await Promise.all([
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name, broker: schema.accounts.broker })
      .from(schema.accounts)
      .orderBy(asc(schema.accounts.name)),
    db
      .select({
        id: schema.imports.id,
        fileName: schema.imports.fileName,
        broker: schema.imports.broker,
        executionCount: schema.imports.executionCount,
        source: schema.imports.source,
        createdAt: schema.imports.createdAt,
        accountName: schema.accounts.name,
      })
      .from(schema.imports)
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.imports.accountId))
      .orderBy(desc(schema.imports.createdAt))
      .limit(50),
    getSettings(),
  ]);

  const inbox = inboxStatus();
  const inboxAccount = accounts.find((a) => a.id === inboxAccountId);

  return (
    <>
      <ImportWizard accounts={accounts} timezone={timezone} />
      {inboxFolder && inboxAccount ? (
        <Panel title="Broker inbox" meta={inbox.watching ? "Watching" : "Not watching"}>
          <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
            <p className="text-[12px] text-faint">
              CSV exports saved to <span className="num text-muted-foreground">{inboxFolder}</span> are imported into{" "}
              <span className="text-muted-foreground">{inboxAccount.name}</span> while Ledger is running.
            </p>
            <InboxSync lastResults={inbox.last?.results} />
          </div>
        </Panel>
      ) : (
        <p className="-mt-2 text-[12px] text-faint">
          Tip: set a broker inbox folder in{" "}
          <Link href="/settings" className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Settings
          </Link>{" "}
          and Tradovate exports saved there import themselves.
        </p>
      )}
      <Panel title="Recent imports" meta="Deleting an import removes its fills and regroups trades">
        <ImportHistory imports={imports} timezone={timezone} />
      </Panel>
    </>
  );
}
