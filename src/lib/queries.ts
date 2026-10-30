import { and, asc, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { rangeStart, type RangeId, type Scope } from "./filters";
import { getSettings } from "./settings/queries";
import { addDaysKey, dayKey, startOfDay } from "./tz";

import { loadClosedTrades, scopeWhere, type JournalTrade } from "./trades/load";

export type { JournalTrade };
export { isMistakeGroup } from "./trades/load";

/** Closed trades in range, with tag names attached. */
export async function getClosedTrades(range: RangeId, scope?: Scope): Promise<JournalTrade[]> {
  // Ranges are relative to "now", so this must render per request.
  await connection();
  const { timezone } = await getSettings();
  return getClosedTradesBetween(rangeStart(range, timezone), null, scope);
}

/** Closed trades on trading days [startDay, endDay) — keys in the trading timezone. */
export async function getClosedTradesInDays(startDay: string, endDay: string, scope?: Scope) {
  const { timezone } = await getSettings();
  return getClosedTradesBetween(startOfDay(startDay, timezone), startOfDay(endDay, timezone), scope);
}

/** Closed trades with closedAt in [start, end). Either bound may be open. */
export async function getClosedTradesBetween(start: Date | null, end: Date | null, scope?: Scope): Promise<JournalTrade[]> {
  await connection();
  const { timezone } = await getSettings();
  return loadClosedTrades(start, end, timezone, scope);
}

/** Positions not yet closed (manual or imported), oldest first. Optionally only those opened on `day`. */
export async function getOpenTrades(scope?: Scope, day?: string) {
  await connection();
  const { trades } = schema;
  const { timezone } = await getSettings();
  const rows = await db
    .select({
      id: trades.id,
      symbol: trades.symbol,
      side: trades.side,
      assetClass: trades.assetClass,
      quantity: trades.quantity,
      entryPrice: trades.entryPrice,
      openedAt: trades.openedAt,
      stopPrice: trades.stopPrice,
      account: schema.accounts.name,
    })
    .from(trades)
    .innerJoin(schema.accounts, eq(schema.accounts.id, trades.accountId))
    .where(
      and(
        isNull(trades.closedAt),
        scopeWhere(scope),
        day ? gte(trades.openedAt, startOfDay(day, timezone)) : undefined,
        day ? lt(trades.openedAt, startOfDay(addDaysKey(day, 1), timezone)) : undefined,
      ),
    )
    .orderBy(asc(trades.openedAt));
  return rows;
}

export async function getAccounts() {
  return db
    .select({ id: schema.accounts.id, name: schema.accounts.name })
    .from(schema.accounts)
    .orderBy(asc(schema.accounts.name));
}

export async function getAllTags() {
  return db
    .select({
      id: schema.tags.id,
      name: schema.tags.name,
      groupId: schema.tags.groupId,
      group: schema.tagGroups.name,
    })
    .from(schema.tags)
    .leftJoin(schema.tagGroups, eq(schema.tagGroups.id, schema.tags.groupId))
    .orderBy(asc(schema.tagGroups.name), asc(schema.tags.name));
}

export async function getTagGroups() {
  return db.select().from(schema.tagGroups).orderBy(asc(schema.tagGroups.name));
}

/** One trade with its fills and tag ids, for the detail panel. */
export async function getTradeDetail(id: number) {
  await connection();
  const trade = await db.query.trades.findFirst({ where: eq(schema.trades.id, id) });
  if (!trade) return null;
  const [fills, tagLinks] = await Promise.all([
    db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.tradeId, id))
      .orderBy(asc(schema.executions.executedAt)),
    db
      .select({ tagId: schema.tradeTags.tagId })
      .from(schema.tradeTags)
      .where(eq(schema.tradeTags.tradeId, id)),
  ]);
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, trade.accountId) });
  return {
    trade,
    fills,
    tagIds: tagLinks.map((t) => t.tagId),
    manual: fills.length === 0,
    defaultRisk: account?.defaultRisk ?? null,
  };
}

/** Trading day (in the trading timezone) of the most recent close, used as a default. */
export async function getLastTradeDay(scope?: Scope): Promise<string | null> {
  await connection();
  const [[row], { timezone }] = await Promise.all([
    db
      .select({ closedAt: schema.trades.closedAt })
      .from(schema.trades)
      .where(and(isNotNull(schema.trades.closedAt), scopeWhere(scope)))
      .orderBy(desc(schema.trades.closedAt))
      .limit(1),
    getSettings(),
  ]);
  return row?.closedAt ? dayKey(row.closedAt, timezone) : null;
}

/** Nearest trading day before/after `day` (exclusive), as a day key. */
export async function getAdjacentTradingDay(day: string, direction: "prev" | "next", scope?: Scope) {
  const { trades } = schema;
  const { timezone } = await getSettings();
  const [row] = await db
    .select({ closedAt: trades.closedAt })
    .from(trades)
    .where(
      direction === "prev"
        ? and(isNotNull(trades.closedAt), lt(trades.closedAt, startOfDay(day, timezone)), scopeWhere(scope))
        : and(isNotNull(trades.closedAt), gte(trades.closedAt, startOfDay(addDaysKey(day, 1), timezone)), scopeWhere(scope)),
    )
    .orderBy(direction === "prev" ? desc(trades.closedAt) : asc(trades.closedAt))
    .limit(1);
  return row?.closedAt ? dayKey(row.closedAt, timezone) : null;
}

export async function getJournalEntry(day: string) {
  await connection();
  return (
    (await db.query.journalEntries.findFirst({ where: eq(schema.journalEntries.day, day) })) ?? null
  );
}
