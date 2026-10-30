"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { importFills, type ImportResult } from "./core";
import { syncInbox } from "./inbox";
import type { ParsedExecution } from "./parse";
import { rebuildTrades, symbolsOfImport } from "./rebuild";

export type { ImportResult } from "./core";

export async function importExecutions(input: {
  accountId: number;
  broker: string;
  fileName: string;
  executions: ParsedExecution[];
}): Promise<ImportResult> {
  const res = await importFills({ ...input, source: "upload" });
  if (res.ok && res.inserted) revalidatePath("/", "layout");
  return res;
}

/** "Sync inbox now": imports whatever is waiting in the watched folder. */
export async function syncInboxNow() {
  const res = await syncInbox();
  if (res.ok && res.run.results.some((r) => r.ok)) revalidatePath("/", "layout");
  return res;
}

export async function deleteImport(importId: number) {
  await db.transaction(async (tx) => {
    const imp = await tx.query.imports.findFirst({ where: eq(schema.imports.id, importId) });
    if (!imp) return;
    const symbols = await symbolsOfImport(tx, importId);
    const affected = await tx
      .selectDistinct({ tradeId: schema.executions.tradeId })
      .from(schema.executions)
      .where(eq(schema.executions.importId, importId));
    // Explicit deletes: SQLite doesn't enforce FK cascades unless enabled per connection.
    await tx.delete(schema.executions).where(eq(schema.executions.importId, importId));
    await tx.delete(schema.imports).where(eq(schema.imports.id, importId));
    await rebuildTrades(
      tx,
      imp.accountId,
      symbols,
      affected.map((r) => r.tradeId).filter((id): id is number => id !== null),
    );
  });
  revalidatePath("/", "layout");
}

export async function createAccount(name: string, broker: string) {
  const trimmed = name.trim().slice(0, 64);
  if (!trimmed) return { ok: false as const, error: "Enter an account name." };
  const [row] = await db
    .insert(schema.accounts)
    .values({ name: trimmed, broker: broker.trim().slice(0, 64) || null })
    .returning({ id: schema.accounts.id });
  revalidatePath("/import");
  return { ok: true as const, id: row.id };
}
