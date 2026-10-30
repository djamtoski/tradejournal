import { Suspense } from "react";
import { connection } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/dashboard/card";
import { ImportWizard } from "@/components/import/import-wizard";
import { ImportHistory } from "@/components/import/import-history";
import { getSettings } from "@/lib/settings/queries";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import" />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 p-6">
        <Suspense fallback={<div className="h-[300px] animate-pulse rounded-[10px] border border-border bg-card" />}>
          <ImportContent />
        </Suspense>
      </div>
    </>
  );
}

async function ImportContent() {
  await connection();
  const [accounts, imports, { timezone }] = await Promise.all([
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
        createdAt: schema.imports.createdAt,
        accountName: schema.accounts.name,
      })
      .from(schema.imports)
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.imports.accountId))
      .orderBy(desc(schema.imports.createdAt))
      .limit(50),
    getSettings(),
  ]);

  return (
    <>
      <ImportWizard accounts={accounts} timezone={timezone} />
      <Panel title="Recent imports" meta="Deleting an import removes its fills and regroups trades">
        <ImportHistory imports={imports} timezone={timezone} />
      </Panel>
    </>
  );
}
