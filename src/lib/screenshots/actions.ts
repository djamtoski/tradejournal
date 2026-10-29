"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { parseDay } from "@/lib/dates";
import { parseAnnotations } from "./annotations";
import { removeImage } from "./storage";

export async function updateScreenshot(
  id: number,
  patch: { annotations?: unknown; caption?: string; day?: string | null; tradeId?: number | null },
) {
  const set: Partial<typeof schema.screenshots.$inferInsert> = {};
  if (patch.annotations !== undefined) set.annotations = parseAnnotations(patch.annotations);
  if (patch.caption !== undefined) set.caption = patch.caption.trim().slice(0, 500) || null;
  if (patch.day !== undefined) set.day = patch.day && parseDay(patch.day) ? patch.day : null;
  if (patch.tradeId !== undefined) set.tradeId = Number.isInteger(patch.tradeId) ? patch.tradeId : null;
  if (Object.keys(set).length) await db.update(schema.screenshots).set(set).where(eq(schema.screenshots.id, id));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function deleteScreenshot(id: number) {
  const row = await db.query.screenshots.findFirst({ where: eq(schema.screenshots.id, id) });
  if (!row) return { ok: true as const };
  await db.delete(schema.screenshots).where(eq(schema.screenshots.id, id));
  await removeImage(row.filePath);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
