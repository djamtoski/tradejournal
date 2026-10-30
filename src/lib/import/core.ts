import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { fingerprints, type ParsedExecution } from "./parse";
import { rebuildTrades } from "./rebuild";

const assetClasses = new Set(["stock", "future", "forex", "option", "cfd"]);
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

export type ImportSource = "upload" | "inbox";

/**
 * Saves parsed fills and regroups trades. Shared by the upload wizard (a server
 * action) and the inbox watcher, so it never touches the request cache itself.
 */
export async function importFills(input: {
  accountId: number;
  broker: string;
  fileName: string;
  executions: ParsedExecution[];
  source?: ImportSource;
}): Promise<ImportResult> {
  const { accountId, executions } = input;
  if (!executions.length) return { ok: false, error: "That file has no fills to import." };
  if (executions.length > MAX_ROWS) return { ok: false, error: `Files are limited to ${MAX_ROWS.toLocaleString("en-US")} rows.` };
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
        source: input.source ?? "upload",
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

    return { ok: true, inserted: fresh.length, skipped: executions.length - fresh.length, trades } as const;
  });
}
