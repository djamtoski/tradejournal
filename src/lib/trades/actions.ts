"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";

const finiteOrNull = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

export async function updateTrade(
  id: number,
  patch: {
    note?: string | null;
    followedRules?: boolean | null;
    mfe?: number | null;
    mae?: number | null;
    stopPrice?: number | null;
    targetPrice?: number | null;
  },
) {
  const set: Partial<typeof schema.trades.$inferInsert> = {};
  if ("note" in patch) set.note = patch.note ? patch.note.slice(0, 20_000) : null;
  if ("followedRules" in patch)
    set.followedRules = typeof patch.followedRules === "boolean" ? patch.followedRules : null;
  for (const key of ["mfe", "mae", "stopPrice", "targetPrice"] as const) {
    if (key in patch) set[key] = finiteOrNull(patch[key]);
  }
  if (!Object.keys(set).length) return { ok: true as const };

  await db.update(schema.trades).set(set).where(eq(schema.trades.id, id));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setTradeTags(tradeId: number, tagIds: number[]) {
  const unique = [...new Set(tagIds.filter((n) => Number.isInteger(n)))];
  await db.transaction(async (tx) => {
    await tx.delete(schema.tradeTags).where(eq(schema.tradeTags.tradeId, tradeId));
    if (unique.length) {
      await tx.insert(schema.tradeTags).values(unique.map((tagId) => ({ tradeId, tagId })));
    }
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function createTag(name: string, groupId: number | null) {
  const trimmed = name.trim().slice(0, 64);
  if (!trimmed) return { ok: false as const, error: "Enter a tag name." };
  const existing = await db.query.tags.findFirst({ where: eq(schema.tags.name, trimmed) });
  if (existing) return { ok: true as const, id: existing.id };
  const [row] = await db
    .insert(schema.tags)
    .values({ name: trimmed, groupId })
    .returning({ id: schema.tags.id });
  revalidatePath("/", "layout");
  return { ok: true as const, id: row.id };
}
