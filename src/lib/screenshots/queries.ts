import { desc, eq, inArray, or } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { dayKey } from "@/lib/dates";
import { parseAnnotations } from "./annotations";

export type ScreenshotItem = {
  id: number;
  src: string;
  caption: string | null;
  day: string | null;
  createdAt: Date;
  annotations: ReturnType<typeof parseAnnotations>;
  trade: { id: number; symbol: string; side: "long" | "short"; netPnl: number; openedAt: Date } | null;
};

/** Screenshots, newest first. Pass a day to get that day's images, including ones linked via a trade. */
export async function getScreenshots(opts: { day?: string; tradeId?: number; id?: number } = {}) {
  await connection();
  const { screenshots, trades } = schema;

  let where;
  if (opts.id) where = eq(screenshots.id, opts.id);
  else if (opts.tradeId) where = eq(screenshots.tradeId, opts.tradeId);
  else if (opts.day) {
    const [y, m, d] = opts.day.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 1);
    const dayTrades = (
      await db.select({ id: trades.id, closedAt: trades.closedAt, openedAt: trades.openedAt }).from(trades)
    )
      .filter((t) => (t.closedAt ?? t.openedAt) >= start && (t.closedAt ?? t.openedAt) < end)
      .map((t) => t.id);
    where = dayTrades.length
      ? or(eq(screenshots.day, opts.day), inArray(screenshots.tradeId, dayTrades))
      : eq(screenshots.day, opts.day);
  }

  const rows = await db
    .select({
      s: screenshots,
      t: { id: trades.id, symbol: trades.symbol, side: trades.side, netPnl: trades.netPnl, openedAt: trades.openedAt },
    })
    .from(screenshots)
    .leftJoin(trades, eq(trades.id, screenshots.tradeId))
    .where(where)
    .orderBy(desc(screenshots.createdAt));

  return rows.map(({ s, t }): ScreenshotItem => ({
    id: s.id,
    src: `/api/screenshots/${s.id}`,
    caption: s.caption,
    day: s.day ?? (t?.openedAt ? dayKey(t.openedAt) : null),
    createdAt: s.createdAt,
    annotations: parseAnnotations(s.annotations),
    trade: t?.id ? (t as ScreenshotItem["trade"]) : null,
  }));
}
