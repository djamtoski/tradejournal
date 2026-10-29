"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { removeImage } from "@/lib/screenshots/storage";
import { getSettings } from "@/lib/settings/queries";
import { validateManualTrade, type FieldErrors, type ManualTradeInput } from "./manual";

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

type SaveResult = { ok: true; id: number } | { ok: false; errors: FieldErrors; error?: string };

/** Trades built from imported fills are regrouped on import, so only hand-entered ones are editable. */
async function hasFills(tradeId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.executions)
    .where(eq(schema.executions.tradeId, tradeId));
  return row.n > 0;
}

export async function createTrade(input: ManualTradeInput): Promise<SaveResult> {
  const { timezone } = await getSettings();
  const res = validateManualTrade(input, timezone);
  if (!res.ok) return res;
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, res.values.accountId) });
  if (!account) return { ok: false, errors: { accountId: "Choose an account." } };

  const [row] = await db.insert(schema.trades).values(res.values).returning({ id: schema.trades.id });
  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export async function updateTradeCore(id: number, input: ManualTradeInput): Promise<SaveResult> {
  if (await hasFills(id)) {
    return { ok: false, errors: {}, error: "This trade came from an import. Edit the broker file and re-import instead." };
  }
  const { timezone } = await getSettings();
  const res = validateManualTrade(input, timezone);
  if (!res.ok) return res;
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, res.values.accountId) });
  if (!account) return { ok: false, errors: { accountId: "Choose an account." } };

  await db.update(schema.trades).set(res.values).where(eq(schema.trades.id, id));
  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteTrade(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await hasFills(id)) {
    return { ok: false, error: "This trade came from an import. Undo the import to remove it." };
  }
  // SQLite doesn't enforce FK cascades here, so remove children explicitly.
  const files = await db.transaction(async (tx) => {
    await tx.delete(schema.tradeTags).where(eq(schema.tradeTags.tradeId, id));
    const shots = await tx
      .delete(schema.screenshots)
      .where(eq(schema.screenshots.tradeId, id))
      .returning({ filePath: schema.screenshots.filePath });
    await tx.delete(schema.trades).where(eq(schema.trades.id, id));
    return shots.map((s) => s.filePath);
  });
  await Promise.all(files.map(removeImage));
  revalidatePath("/", "layout");
  return { ok: true };
}
