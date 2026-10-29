"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { parseDay } from "@/lib/dates";

const MAX_LENGTH = 100_000;

export async function saveJournalEntry(input: {
  day: string;
  content: string;
  followedRules: boolean | null;
}) {
  if (!parseDay(input.day)) return { ok: false as const, error: "Invalid date." };
  const content = input.content.slice(0, MAX_LENGTH);
  const followedRules = typeof input.followedRules === "boolean" ? input.followedRules : null;
  const updatedAt = new Date();

  await db
    .insert(schema.journalEntries)
    .values({ day: input.day, content, followedRules, updatedAt })
    .onConflictDoUpdate({
      target: schema.journalEntries.day,
      set: { content, followedRules, updatedAt },
    });

  revalidatePath("/daily");
  revalidatePath("/journal");
  return { ok: true as const, updatedAt: updatedAt.getTime() };
}
