import { and, asc, eq, gte, isNotNull } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { rangeStart, type RangeId } from "./filters";
import type { StatTrade } from "./stats";

/** Closed trades in range, with tag names attached. */
export async function getClosedTrades(range: RangeId): Promise<StatTrade[]> {
  // Ranges are relative to "now", so this must render per request.
  await connection();
  const start = rangeStart(range);
  const { trades } = schema;

  const rows = await db.query.trades.findMany({
    where: and(
      isNotNull(trades.closedAt),
      start ? gte(trades.closedAt, start) : undefined,
    ),
    orderBy: asc(trades.closedAt),
    columns: {
      id: true,
      symbol: true,
      side: true,
      openedAt: true,
      closedAt: true,
      grossPnl: true,
      netPnl: true,
    },
  });

  const tagRows = await db
    .select({ tradeId: schema.tradeTags.tradeId, name: schema.tags.name })
    .from(schema.tradeTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.tradeTags.tagId));
  const tagsByTrade = new Map<number, string[]>();
  for (const { tradeId, name } of tagRows) {
    tagsByTrade.set(tradeId, [...(tagsByTrade.get(tradeId) ?? []), name]);
  }

  return rows.map((r) => ({
    ...r,
    closedAt: r.closedAt!,
    tags: tagsByTrade.get(r.id) ?? [],
  }));
}
