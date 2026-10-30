/** Shared argument parsing for the review scripts: --day|--week <YYYY-MM-DD|latest|today>. */
import { desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "../src/db";
import { parseDay } from "../src/lib/dates";
import { reviewRange, type ReviewPeriod } from "../src/lib/review/packet";
import { DEFAULT_TIMEZONE, dayKey, isValidTimezone } from "../src/lib/tz";

export async function tradingTimezone() {
  const saved = await db.query.settings.findFirst({ where: eq(schema.settings.key, "timezone") });
  return saved && isValidTimezone(saved.value) ? saved.value : DEFAULT_TIMEZONE;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function flag(args: string[], name: string) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function readPeriod(args: string[], timezone: string) {
  const day = flag(args, "day");
  const week = flag(args, "week");
  if (!day === !week) fail("Pass exactly one of --day or --week, each with YYYY-MM-DD, latest or today.");
  const period: ReviewPeriod = day ? "day" : "week";
  const raw = (day ?? week)!;

  let key = raw;
  if (raw === "today") key = dayKey(new Date(), timezone);
  if (raw === "latest") {
    const last = await db
      .select({ closedAt: schema.trades.closedAt })
      .from(schema.trades)
      .where(isNotNull(schema.trades.closedAt))
      .orderBy(desc(schema.trades.closedAt))
      .limit(1);
    if (!last[0]?.closedAt) fail("There are no closed trades yet.");
    key = dayKey(last[0].closedAt, timezone);
  }
  if (!parseDay(key)) fail(`Not a date: ${raw}. Use YYYY-MM-DD, latest or today.`);
  return { period, ...reviewRange(period, key) };
}
