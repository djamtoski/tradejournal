import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildTrades } from "./build-trades";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Regroups every fill of the given symbols into trades. Existing trades are
 * matched by open time and updated in place, so their tags, notes, ratings
 * and screenshots survive re-imports. Manual trades (no fills) are untouched.
 */
export async function rebuildTrades(
  tx: Tx,
  accountId: number,
  symbols: string[],
  /** Trades whose fills were just deleted, so they can't be found via fills. */
  orphanTradeIds: number[] = [],
) {
  const { executions, trades } = schema;
  let count = 0;

  for (const symbol of symbols) {
    const fills = await tx
      .select()
      .from(executions)
      .where(and(eq(executions.accountId, accountId), eq(executions.symbol, symbol)))
      .orderBy(asc(executions.executedAt));

    const built = fills.length
      ? buildTrades(
          fills.map((f) => ({ ...f, executedAt: f.executedAt.getTime() })),
          fills[0].multiplier,
        )
      : [];

    // Trades previously built from fills for this symbol.
    const linkedIds = [
      ...new Set([
        ...fills.map((f) => f.tradeId).filter((id): id is number => id !== null),
        ...orphanTradeIds,
      ]),
    ];
    const existing = linkedIds.length
      ? await tx
          .select()
          .from(trades)
          .where(and(inArray(trades.id, linkedIds), eq(trades.symbol, symbol)))
      : [];
    const byOpen = new Map(existing.map((t) => [t.openedAt.getTime(), t]));
    const kept = new Set<number>();

    for (const b of built) {
      const values = {
        accountId,
        symbol,
        assetClass: fills[0].assetClass,
        side: b.side,
        multiplier: fills[0].multiplier,
        quantity: b.quantity,
        entryPrice: b.entryPrice,
        exitPrice: b.exitPrice,
        openedAt: new Date(b.openedAt),
        closedAt: b.closedAt === null ? null : new Date(b.closedAt),
        grossPnl: b.grossPnl,
        fees: b.fees,
        netPnl: b.netPnl,
      };
      const match = byOpen.get(b.openedAt);
      let tradeId: number;
      if (match && !kept.has(match.id)) {
        await tx.update(trades).set(values).where(eq(trades.id, match.id));
        tradeId = match.id;
      } else {
        const [row] = await tx.insert(trades).values(values).returning({ id: trades.id });
        tradeId = row.id;
      }
      kept.add(tradeId);
      await tx.update(executions).set({ tradeId }).where(inArray(executions.id, b.fillIds));
      count++;
    }

    const stale = existing.filter((t) => !kept.has(t.id)).map((t) => t.id);
    if (stale.length) {
      // FK cascades aren't enforced by SQLite here, so clean up children by hand.
      await tx.delete(schema.tradeTags).where(inArray(schema.tradeTags.tradeId, stale));
      await tx
        .update(schema.screenshots)
        .set({ tradeId: null })
        .where(inArray(schema.screenshots.tradeId, stale));
      await tx.delete(trades).where(inArray(trades.id, stale));
    }
  }

  return count;
}

/** Symbols with at least one fill in this import. */
export async function symbolsOfImport(tx: Tx, importId: number) {
  const rows = await tx
    .selectDistinct({ symbol: schema.executions.symbol })
    .from(schema.executions)
    .where(and(eq(schema.executions.importId, importId), isNotNull(schema.executions.symbol)));
  return rows.map((r) => r.symbol);
}
