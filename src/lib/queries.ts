import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { rangeStart, type RangeId, type Scope } from "./filters";
import { getSettings } from "./settings/queries";
import { riskOf, type StatTrade } from "./stats";
import { addDaysKey, dayKey, startOfDay, zonedParts } from "./tz";

export type JournalTrade = StatTrade & {
  assetClass: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  fees: number;
  followedRules: boolean | null;
  note: string | null;
  accountId: number;
  multiplier: number;
  stopPrice: number | null;
  targetPrice: number | null;
  /** Tags from the "Mistake" group; `tags` holds the rest (setups etc). */
  mistakes: string[];
};

/** SQL conditions for the shared account / asset-class filter. Empty lists mean "all". */
function scopeWhere(scope?: Scope) {
  const { trades } = schema;
  return and(
    scope?.accountIds.length ? inArray(trades.accountId, scope.accountIds) : undefined,
    scope?.assetClasses.length ? inArray(trades.assetClass, scope.assetClasses) : undefined,
  );
}

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
export async function getClosedTradesBetween(
  start: Date | null,
  end: Date | null,
  scope?: Scope,
): Promise<JournalTrade[]> {
  await connection();
  const { trades } = schema;
  const { timezone } = await getSettings();

  const rows = await db.query.trades.findMany({
    where: and(
      isNotNull(trades.closedAt),
      start ? gte(trades.closedAt, start) : undefined,
      end ? lt(trades.closedAt, end) : undefined,
      scopeWhere(scope),
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
      accountId: true,
      multiplier: true,
      stopPrice: true,
      targetPrice: true,
    },
  });
  const defaultRisk = new Map(
    (await db.select({ id: schema.accounts.id, risk: schema.accounts.defaultRisk }).from(schema.accounts)).map(
      (a) => [a.id, a.risk],
    ),
  );

  const tagRows = await db
    .select({
      tradeId: schema.tradeTags.tradeId,
      name: schema.tags.name,
      group: schema.tagGroups.name,
    })
    .from(schema.tradeTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.tradeTags.tagId))
    .leftJoin(schema.tagGroups, eq(schema.tagGroups.id, schema.tags.groupId));
  const tagsByTrade = new Map<number, { tags: string[]; mistakes: string[] }>();
  for (const { tradeId, name, group } of tagRows) {
    const entry = tagsByTrade.get(tradeId) ?? { tags: [], mistakes: [] };
    (isMistakeGroup(group) ? entry.mistakes : entry.tags).push(name);
    tagsByTrade.set(tradeId, entry);
  }

  return rows.map((r) => {
    const opened = zonedParts(r.openedAt, timezone);
    return {
      ...r,
      closedAt: r.closedAt!,
      day: dayKey(r.closedAt!, timezone),
      openHour: opened.hour,
      openWeekday: opened.weekday,
      risk: riskOf({ ...r, defaultRisk: defaultRisk.get(r.accountId) ?? null }),
      tags: tagsByTrade.get(r.id)?.tags ?? [],
      mistakes: tagsByTrade.get(r.id)?.mistakes ?? [],
    };
  });
}

/** Tags in a group named "Mistake(s)" are tracked separately from setups. */
export const isMistakeGroup = (group: string | null) => !!group && /^mistakes?$/i.test(group.trim());

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
