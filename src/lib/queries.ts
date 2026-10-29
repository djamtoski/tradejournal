import { and, asc, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { rangeStart, type RangeId } from "./filters";
import type { StatTrade } from "./stats";

export type JournalTrade = StatTrade & {
  assetClass: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  fees: number;
  followedRules: boolean | null;
  note: string | null;
};

/** Closed trades in range, with tag names attached. */
export async function getClosedTrades(range: RangeId): Promise<JournalTrade[]> {
  // Ranges are relative to "now", so this must render per request.
  await connection();
  return getClosedTradesBetween(rangeStart(range), null);
}

/** Closed trades with closedAt in [start, end). Either bound may be open. */
export async function getClosedTradesBetween(
  start: Date | null,
  end: Date | null,
): Promise<JournalTrade[]> {
  await connection();
  const { trades } = schema;

  const rows = await db.query.trades.findMany({
    where: and(
      isNotNull(trades.closedAt),
      start ? gte(trades.closedAt, start) : undefined,
      end ? lt(trades.closedAt, end) : undefined,
    ),
    orderBy: asc(trades.closedAt),
    columns: {
      id: true,
      symbol: true,
      side: true,
      assetClass: true,
      quantity: true,
      entryPrice: true,
      exitPrice: true,
      openedAt: true,
      closedAt: true,
      grossPnl: true,
      fees: true,
      netPnl: true,
      followedRules: true,
      note: true,
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

/** Most recent close time, used to pick a default day or month. */
export async function getLastTradeDate(): Promise<Date | null> {
  await connection();
  const [row] = await db
    .select({ closedAt: schema.trades.closedAt })
    .from(schema.trades)
    .where(isNotNull(schema.trades.closedAt))
    .orderBy(desc(schema.trades.closedAt))
    .limit(1);
  return row?.closedAt ?? null;
}

/** Nearest trading day before/after `day` (exclusive), as a Date at local midnight. */
export async function getAdjacentTradingDay(day: Date, direction: "prev" | "next") {
  const { trades } = schema;
  const nextMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const [row] = await db
    .select({ closedAt: trades.closedAt })
    .from(trades)
    .where(
      direction === "prev"
        ? and(isNotNull(trades.closedAt), lt(trades.closedAt, day))
        : and(isNotNull(trades.closedAt), gte(trades.closedAt, nextMidnight)),
    )
    .orderBy(direction === "prev" ? desc(trades.closedAt) : asc(trades.closedAt))
    .limit(1);
  if (!row?.closedAt) return null;
  const d = row.closedAt;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function getJournalEntry(day: string) {
  await connection();
  return (
    (await db.query.journalEntries.findFirst({ where: eq(schema.journalEntries.day, day) })) ?? null
  );
}
