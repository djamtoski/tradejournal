/**
 * Prints the review packet for one day or week, for the /review-trades skill.
 *   npm run review:data -- --day 2026-10-28
 *   npm run review:data -- --week latest
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { breachesByDay, dayStatuses, streaks } from "../src/lib/goals/evaluate";
import { buildPacket } from "../src/lib/review/packet";
import { loadClosedTrades } from "../src/lib/trades/load";
import { addDaysKey } from "../src/lib/tz";
import { readPeriod, tradingTimezone } from "./review-args";

async function main() {
  const timezone = await tradingTimezone();
  const { period, start, end } = await readPeriod(process.argv.slice(2), timezone);

  const [all, goals, journalRows, playbooks] = await Promise.all([
    loadClosedTrades(null, null, timezone),
    db.select().from(schema.goals),
    db.select().from(schema.journalEntries),
    db
      .select({ title: schema.playbooks.title, content: schema.playbooks.content, tag: schema.tags.name })
      .from(schema.playbooks)
      .leftJoin(schema.tags, eq(schema.tags.id, schema.playbooks.tagId)),
  ]);
  const baselineStart = addDaysKey(start, -30);
  const journal = new Map(journalRows.map((j) => [j.day, j]));
  const history = dayStatuses(all, goals, journal);

  const packet = buildPacket({
    period,
    start,
    end,
    timezone,
    trades: all.filter((t) => t.day >= start && t.day < end),
    baseline: all.filter((t) => t.day >= baselineStart && t.day < start),
    journal: journalRows.filter((j) => j.day >= start && j.day < end).sort((a, b) => (a.day < b.day ? -1 : 1)),
    goals,
    breaches: breachesByDay(all, goals),
    // Streaks as of the end of the reviewed period, not today.
    streaks: streaks(history.filter((d) => d.day < end)),
    playbooks,
  });

  const existing = await db.query.reviews.findFirst({
    where: and(eq(schema.reviews.period, period), eq(schema.reviews.startDay, start)),
  });
  console.log(packet);
  console.log("---");
  console.log(`Period: ${period} starting ${start}.${existing ? " A review already exists and saving will replace it." : ""}`);
  console.log(`Save with: npm run review:save -- --${period} ${start} --file <path-to-markdown>`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
