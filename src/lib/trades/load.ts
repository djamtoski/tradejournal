/**
 * Loads closed trades with tags, trading-day keys and risk attached. Free of
 * Next.js APIs so CLI scripts (the review packet) can use it too; pages go
 * through getClosedTradesBetween in ../queries.ts.
 */
import { and, asc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "../../db";
import type { Scope } from "../filters";
import { riskOf, type StatTrade } from "../stats";
import { dayKey, zonedParts } from "../tz";
import { isConfluenceGroup } from "./fields";

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
  /** Tags from the "Mistake" group; `confluences` from "Confluence"; `tags` holds the rest (setups). */
  mistakes: string[];
  confluences: string[];
  grade: string | null;
  exitReason: string | null;
};

/** SQL conditions for the shared account / asset-class filter. Empty lists mean "all". */
export function scopeWhere(scope?: Scope) {
  const { trades } = schema;
  return and(
    scope?.accountIds.length ? inArray(trades.accountId, scope.accountIds) : undefined,
    scope?.assetClasses.length ? inArray(trades.assetClass, scope.assetClasses) : undefined,
  );
}

/** Closed trades with closedAt in [start, end). Either bound may be open. */
export async function loadClosedTrades(
  start: Date | null,
  end: Date | null,
  timezone: string,
  scope?: Scope,
): Promise<JournalTrade[]> {
  const { trades } = schema;

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
      grade: true,
      exitReason: true,
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
  const tagsByTrade = new Map<number, { tags: string[]; mistakes: string[]; confluences: string[] }>();
  for (const { tradeId, name, group } of tagRows) {
    const entry = tagsByTrade.get(tradeId) ?? { tags: [], mistakes: [], confluences: [] };
    (isMistakeGroup(group) ? entry.mistakes : isConfluenceGroup(group) ? entry.confluences : entry.tags).push(name);
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
      confluences: tagsByTrade.get(r.id)?.confluences ?? [],
    };
  });
}

/** Tags in a group named "Mistake(s)" are tracked separately from setups. */
export const isMistakeGroup = (group: string | null) => !!group && /^mistakes?$/i.test(group.trim());
