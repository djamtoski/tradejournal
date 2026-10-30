import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ReviewPeriod } from "./packet";

export async function getReview(period: ReviewPeriod, startDay: string) {
  return (
    (await db.query.reviews.findFirst({
      where: and(eq(schema.reviews.period, period), eq(schema.reviews.startDay, startDay)),
    })) ?? null
  );
}

export async function getReviews(period?: ReviewPeriod) {
  return db
    .select()
    .from(schema.reviews)
    .where(period ? eq(schema.reviews.period, period) : undefined)
    .orderBy(desc(schema.reviews.startDay), desc(schema.reviews.period));
}

/** Which of these Mondays have a saved week review. */
export async function weekReviewSet(mondays: string[]) {
  if (!mondays.length) return new Set<string>();
  const rows = await db
    .select({ startDay: schema.reviews.startDay })
    .from(schema.reviews)
    .where(and(eq(schema.reviews.period, "week"), inArray(schema.reviews.startDay, mondays)));
  return new Set(rows.map((r) => r.startDay));
}
