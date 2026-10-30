/**
 * Saves a written review so it shows in the app, replacing any earlier one.
 *   npm run review:save -- --day 2026-10-28 --file data/review-draft.md
 */
import { readFile } from "node:fs/promises";
import { db, schema } from "../src/db";
import { fail, flag, readPeriod, tradingTimezone } from "./review-args";

const MAX_CHARS = 50_000;

async function main() {
  const args = process.argv.slice(2);
  const file = flag(args, "file");
  if (!file) fail("Pass --file <path> with the review in markdown.");
  const { period, start } = await readPeriod(args, await tradingTimezone());

  const content = (await readFile(file, "utf8").catch(() => fail(`Can't read ${file}.`))).replace(/^﻿/, "").trim();
  if (!content) fail("The review file is empty.");
  if (content.length > MAX_CHARS) fail(`Reviews are limited to ${MAX_CHARS.toLocaleString("en-US")} characters.`);

  const updatedAt = new Date();
  await db
    .insert(schema.reviews)
    .values({ period, startDay: start, content, updatedAt })
    .onConflictDoUpdate({ target: [schema.reviews.period, schema.reviews.startDay], set: { content, updatedAt } });

  const where = period === "day" ? `/daily?date=${start}` : `/reviews#week-${start}`;
  console.log(`Saved the ${period} review for ${start} (${content.length.toLocaleString("en-US")} characters). See it at http://localhost:3000${where}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
