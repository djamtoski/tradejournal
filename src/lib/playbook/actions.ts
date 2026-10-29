"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";

export async function createPlaybook() {
  const [row] = await db
    .insert(schema.playbooks)
    .values({ title: "Untitled setup" })
    .returning({ id: schema.playbooks.id });
  revalidatePath("/playbook");
  redirect(`/playbook?id=${row.id}`);
}

export async function updatePlaybook(
  id: number,
  patch: { title?: string; content?: string; tagId?: number | null },
) {
  const set: Partial<typeof schema.playbooks.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title.trim().slice(0, 120) || "Untitled setup";
  if (patch.content !== undefined) set.content = patch.content.slice(0, 100_000);
  if (patch.tagId !== undefined) set.tagId = Number.isInteger(patch.tagId) ? patch.tagId : null;
  await db.update(schema.playbooks).set(set).where(eq(schema.playbooks.id, id));
  revalidatePath("/playbook");
  return { ok: true as const };
}

export async function deletePlaybook(id: number) {
  await db.delete(schema.playbooks).where(eq(schema.playbooks.id, id));
  revalidatePath("/playbook");
  redirect("/playbook");
}
