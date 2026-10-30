"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { validateGoal, type GoalInput } from "./evaluate";

type Result = { ok: true } | { ok: false; error: string };

const done = (): Result => {
  revalidatePath("/", "layout");
  return { ok: true };
};

async function accountExists(id: number | null) {
  if (id === null) return true;
  return !!(await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) }));
}

export async function createGoal(input: GoalInput): Promise<Result> {
  const res = validateGoal(input);
  if (!res.ok) return res;
  if (!(await accountExists(res.goal.accountId))) return { ok: false, error: "That account no longer exists." };
  await db.insert(schema.goals).values(res.goal);
  return done();
}

/** Changes the amount only; kind, period and account are fixed once created. */
export async function updateGoalValue(id: number, raw: string): Promise<Result> {
  const existing = await db.query.goals.findFirst({ where: eq(schema.goals.id, id) });
  if (!existing) return { ok: false, error: "That goal no longer exists." };
  const res = validateGoal({ ...existing, value: Number(raw.replace(/[$,\s]/g, "")) });
  if (!res.ok) return res;
  await db.update(schema.goals).set({ value: res.goal.value }).where(eq(schema.goals.id, id));
  return done();
}

export async function setGoalActive(id: number, active: boolean): Promise<Result> {
  await db.update(schema.goals).set({ active }).where(eq(schema.goals.id, id));
  return done();
}

export async function deleteGoal(id: number): Promise<Result> {
  await db.delete(schema.goals).where(eq(schema.goals.id, id));
  return done();
}
