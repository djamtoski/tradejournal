"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { fingerprints, type ParsedExecution } from "./parse";
import { rebuildTrades, symbolsOfImport } from "./rebuild";

const assetClasses = new Set(["stock", "future", "forex", "option"]);
const MAX_ROWS = 50_000;

function isValid(e: ParsedExecution) {
  return (
    typeof e.symbol === "string" && e.symbol.length > 0 && e.symbol.length <= 64 &&
    (e.action === "buy" || e.action === "sell") &&
    assetClasses.has(e.assetClass) &&
    Number.isFinite(e.quantity) && e.quantity > 0 &&
    Number.isFinite(e.price) && e.price >= 0 &&
    Number.isFinite(e.fees) && e.fees >= 0 &&
    Number.isFinite(e.multiplier) && e.multiplier > 0 &&
    Number.isFinite(e.executedAt)
  );
}

export type ImportResult =
  | { ok: true; inserted: number; skipped: number; trades: number }
  | { ok: false; error: string };

export async function importExecutions(input: {
  accountId: number;
  broker: string;
  fileName: string;
  executions: ParsedExecution[];
}): Promise<ImportResult> {
  const { accountId, executions } = input;
  if (!executions.length) return { ok: false, error: "That file has no fills to import." };
  if (executions.length > MAX_ROWS) return { ok: false, error: `Files are limited to ${MAX_ROWS.toLocaleString()} rows.` };
  if (!executions.every(isValid)) return { ok: false, error: "Some rows are invalid. Check the preview and try again." };

  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account) return { ok: false, error: "Choose an account first." };

  const prints = fingerprints(executions);

  return db.transaction(async (tx) => {
    const existing = new Set<string>();
    for (let i = 0; i < prints.length; i += 500) {
      const rows = await tx
        .select({ fingerprint: schema.executions.fingerprint })
        .from(schema.executions)
        .where(and(
          eq(schema.executions.accountId, accountId),
          inArray(schema.executions.fingerprint, prints.slice(i, i + 500)),
        ));
      rows.forEach((r) => existing.add(r.fingerprint));
    }

    const fresh = executions
      .map((e, i) => ({ e, fingerprint: prints[i] }))
      .filter(({ fingerprint }) => !existing.has(fingerprint));

    if (!fresh.length) {
      return { ok: true, inserted: 0, skipped: executions.length, trades: 0 } as const;
    }

    const [imp] = await tx
      .insert(schema.imports)
      .values({
        accountId,
        broker: input.broker.slice(0, 64) || "CSV",
        fileName: input.fileName.slice(0, 255),
        executionCount: fresh.length,
      })
      .returning({ id: schema.imports.id });

    for (let i = 0; i < fresh.length; i += 500) {
      await tx.insert(schema.executions).values(
        fresh.slice(i, i + 500).map(({ e, fingerprint }) => ({
          accountId,
          importId: imp.id,
          symbol: e.symbol,
          assetClass: e.assetClass,
          action: e.action,
          quantity: e.quantity,
          price: e.price,
          fees: e.fees,
          multiplier: e.multiplier,
          executedAt: new Date(e.executedAt),
          fingerprint,
        })),
      );
    }

    const symbols = [...new Set(fresh.map(({ e }) => e.symbol))];
    const trades = await rebuildTrades(tx, accountId, symbols);

    revalidatePath("/", "layout");
    return { ok: true, inserted: fresh.length, skipped: executions.length - fresh.length, trades } as const;
  });
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
