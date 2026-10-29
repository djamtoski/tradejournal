import { and, asc, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { rangeStart, type RangeId } from "./filters";
import { getSettings } from "./settings/queries";
import type { StatTrade } from "./stats";
import { addDaysKey, dayKey, startOfDay, zonedParts } from "./tz";

export type JournalTrade = StatTrade & {
  assetClass: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  fees: number;
  followedRules: boolean | null;
  note: string | null;
  /** Tags from the "Mistake" group; `tags` holds the rest (setups etc). */
  mistakes: string[];
};

/** Closed trades in range, with tag names attached. */
export async function getClosedTrades(range: RangeId): Promise<JournalTrade[]> {
  // Ranges are relative to "now", so this must render per request.
  await connection();
  const { timezone } = await getSettings();
  return getClosedTradesBetween(rangeStart(range, timezone), null);
}

/** Closed trades on trading days [startDay, endDay) — keys in the trading timezone. */
export async function getClosedTradesInDays(startDay: string, endDay: string) {
  const { timezone } = await getSettings();
  return getClosedTradesBetween(startOfDay(startDay, timezone), startOfDay(endDay, timezone));
}

/** Closed trades with closedAt in [start, end). Either bound may be open. */
export async function getClosedTradesBetween(
  start: Date | null,
  end: Date | null,
): Promise<JournalTrade[]> {
  await connection();
  const { trades } = schema;
  const { timezone } = await getSettings();

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
      tags: tagsByTrade.get(r.id)?.tags ?? [],
      mistakes: tagsByTrade.get(r.id)?.mistakes ?? [],
    };
  });
}

/** Tags in a group named "Mistake(s)" are tracked separately from setups. */
export const isMistakeGroup = (group: string | null) => !!group && /^mistakes?$/i.test(group.trim());

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
  return { trade, fills, tagIds: tagLinks.map((t) => t.tagId) };
}

/** Trading day (in the trading timezone) of the most recent close, used as a default. */
export async function getLastTradeDay(): Promise<string | null> {
  await connection();
  const [[row], { timezone }] = await Promise.all([
    db
      .select({ closedAt: schema.trades.closedAt })
      .from(schema.trades)
      .where(isNotNull(schema.trades.closedAt))
      .orderBy(desc(schema.trades.closedAt))
      .limit(1),
    getSettings(),
  ]);
  return row?.closedAt ? dayKey(row.closedAt, timezone) : null;
}

/** Nearest trading day before/after `day` (exclusive), as a day key. */
export async function getAdjacentTradingDay(day: string, direction: "prev" | "next") {
  const { trades } = schema;
  const { timezone } = await getSettings();
  const [row] = await db
    .select({ closedAt: trades.closedAt })
    .from(trades)
    .where(
      direction === "prev"
        ? and(isNotNull(trades.closedAt), lt(trades.closedAt, startOfDay(day, timezone)))
        : and(isNotNull(trades.closedAt), gte(trades.closedAt, startOfDay(addDaysKey(day, 1), timezone))),
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
