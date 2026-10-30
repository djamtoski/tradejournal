import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getClosedTradesBetween } from "@/lib/queries";
import { dayStatuses, streaks, type Goal, type JournalDay } from "./evaluate";

export const getGoals = cache(async (): Promise<Goal[]> =>
  db.select().from(schema.goals).orderBy(asc(schema.goals.createdAt), asc(schema.goals.id)),
);

export async function getJournalDays() {
  const rows = await db
    .select({ day: schema.journalEntries.day, content: schema.journalEntries.content, followedRules: schema.journalEntries.followedRules })
    .from(schema.journalEntries);
  return new Map<string, JournalDay>(rows.map((r) => [r.day, r]));
}

/**
 * Every closed trade across all accounts, with per-day goal status and streaks.
 * Goals ignore the filter bar: a limit is about everything you traded that day.
 */
export const getGoalHistory = cache(async () => {
  const [goals, trades, journal] = await Promise.all([getGoals(), getClosedTradesBetween(null, null), getJournalDays()]);
  const days = dayStatuses(trades, goals, journal);
  return { goals, trades, days, streaks: streaks(days) };
});
