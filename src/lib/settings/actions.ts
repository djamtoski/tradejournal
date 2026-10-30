"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { removeImage } from "@/lib/screenshots/storage";
import { isValidTimezone } from "@/lib/tz";
import { startInboxWatcher, stopInboxWatcher } from "@/lib/import/inbox";
import { homedir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";
import { stat } from "node:fs/promises";

// SQLite here doesn't enforce FK cascades, so every delete cleans up its children explicitly.

type Result = { ok: true } | { ok: false; error: string };

const inboxKeys = ["inboxFolder", "inboxAccountId"];

const clean = (s: string, max = 64) => s.trim().slice(0, max);
const done = (): Result => {
  revalidatePath("/", "layout");
  return { ok: true };
};

export async function renameAccount(id: number, name: string, broker: string): Promise<Result> {
  const n = clean(name);
  if (!n) return { ok: false, error: "Enter an account name." };
  await db
    .update(schema.accounts)
    .set({ name: n, broker: clean(broker) || null })
    .where(eq(schema.accounts.id, id));
  return done();
}

export async function deleteAccount(id: number): Promise<Result> {
  const files: string[] = [];
  await db.transaction(async (tx) => {
    const tradeIds = (
      await tx.select({ id: schema.trades.id }).from(schema.trades).where(eq(schema.trades.accountId, id))
    ).map((r) => r.id);
    for (let i = 0; i < tradeIds.length; i += 500) {
      const chunk = tradeIds.slice(i, i + 500);
      await tx.delete(schema.tradeTags).where(inArray(schema.tradeTags.tradeId, chunk));
      const shots = await tx
        .delete(schema.screenshots)
        .where(inArray(schema.screenshots.tradeId, chunk))
        .returning({ filePath: schema.screenshots.filePath });
      files.push(...shots.map((s) => s.filePath));
    }
    await tx.delete(schema.executions).where(eq(schema.executions.accountId, id));
    await tx.delete(schema.trades).where(eq(schema.trades.accountId, id));
    await tx.delete(schema.imports).where(eq(schema.imports.accountId, id));
    await tx.delete(schema.goals).where(eq(schema.goals.accountId, id));
    const inbox = await tx.query.settings.findFirst({ where: eq(schema.settings.key, "inboxAccountId") });
    if (inbox?.value === String(id)) await tx.delete(schema.settings).where(inArray(schema.settings.key, inboxKeys));
    await tx.delete(schema.accounts).where(eq(schema.accounts.id, id));
  });
  await Promise.all(files.map(removeImage));
  await startInboxWatcher(); // stops it if the inbox pointed at this account
  return done();
}

export async function createTagGroup(name: string): Promise<Result> {
  const n = clean(name);
  if (!n) return { ok: false, error: "Enter a group name." };
  const exists = await db.query.tagGroups.findFirst({ where: eq(schema.tagGroups.name, n) });
  if (exists) return { ok: false, error: "That group already exists." };
  await db.insert(schema.tagGroups).values({ name: n });
  return done();
}

export async function renameTagGroup(id: number, name: string): Promise<Result> {
  const n = clean(name);
  if (!n) return { ok: false, error: "Enter a group name." };
  const clash = await db.query.tagGroups.findFirst({
    where: and(eq(schema.tagGroups.name, n), ne(schema.tagGroups.id, id)),
  });
  if (clash) return { ok: false, error: "Another group has that name." };
  await db.update(schema.tagGroups).set({ name: n }).where(eq(schema.tagGroups.id, id));
  return done();
}

/** Tags in the group are kept and become ungrouped. */
export async function deleteTagGroup(id: number): Promise<Result> {
  await db.transaction(async (tx) => {
    await tx.update(schema.tags).set({ groupId: null }).where(eq(schema.tags.groupId, id));
    await tx.delete(schema.tagGroups).where(eq(schema.tagGroups.id, id));
  });
  return done();
}

export async function createTagInGroup(name: string, groupId: number | null): Promise<Result> {
  const n = clean(name);
  if (!n) return { ok: false, error: "Enter a tag name." };
  const exists = await db.query.tags.findFirst({ where: eq(schema.tags.name, n) });
  if (exists) return { ok: false, error: "That tag already exists." };
  await db.insert(schema.tags).values({ name: n, groupId });
  return done();
}

export async function updateTag(id: number, patch: { name?: string; groupId?: number | null }): Promise<Result> {
  const set: Partial<typeof schema.tags.$inferInsert> = {};
  if (patch.name !== undefined) {
    const n = clean(patch.name);
    if (!n) return { ok: false, error: "Enter a tag name." };
    const clash = await db.query.tags.findFirst({ where: and(eq(schema.tags.name, n), ne(schema.tags.id, id)) });
    if (clash) return { ok: false, error: "Another tag has that name." };
    set.name = n;
  }
  if (patch.groupId !== undefined) set.groupId = patch.groupId;
  if (Object.keys(set).length) await db.update(schema.tags).set(set).where(eq(schema.tags.id, id));
  return done();
}

/** Removes the tag from every trade and unlinks playbook entries. */
export async function deleteTag(id: number): Promise<Result> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.tradeTags).where(eq(schema.tradeTags.tagId, id));
    await tx.update(schema.playbooks).set({ tagId: null }).where(eq(schema.playbooks.tagId, id));
    await tx.delete(schema.tags).where(eq(schema.tags.id, id));
  });
  return done();
}

export async function eraseAllData(confirmation: string): Promise<Result> {
  if (confirmation.trim().toLowerCase() !== "erase everything") {
    return { ok: false, error: "Type “erase everything” to confirm." };
  }
  const files: string[] = [];
  await db.transaction(async (tx) => {
    await tx.delete(schema.tradeTags);
    const shots = await tx.delete(schema.screenshots).returning({ filePath: schema.screenshots.filePath });
    files.push(...shots.map((s) => s.filePath));
    await tx.delete(schema.executions);
    await tx.delete(schema.playbooks);
    await tx.delete(schema.trades);
    await tx.delete(schema.imports);
    await tx.delete(schema.journalEntries);
    await tx.delete(schema.goals);
    await tx.delete(schema.reviews);
    await tx.delete(schema.settings).where(inArray(schema.settings.key, inboxKeys));
    await tx.delete(schema.tags);
    await tx.delete(schema.tagGroups);
    await tx.delete(schema.accounts);
  });
  await Promise.all(files.map(removeImage));
  stopInboxWatcher();
  return done();
}

export async function setTimezone(tz: string): Promise<Result> {
  if (!isValidTimezone(tz)) return { ok: false, error: "Choose a timezone from the list." };
  await db
    .insert(schema.settings)
    .values({ key: "timezone", value: tz })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: tz } });
  return done();
}

/** Dollar value of 1R for trades in this account without a stop. Blank clears it. */
export async function setAccountRisk(id: number, raw: string): Promise<Result> {
  const text = raw.replace(/[$,\s]/g, "");
  const value = text === "" ? null : Number(text);
  if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 10_000_000)) {
    return { ok: false, error: "Enter an amount above 0" };
  }
  await db.update(schema.accounts).set({ defaultRisk: value }).where(eq(schema.accounts.id, id));
  return done();
}

/** Folder to watch for broker exports and the account they go into. A blank folder turns the inbox off. */
export async function setInbox(folder: string, accountId: number | null): Promise<Result> {
  const dir = folder.trim().replace(/^"(.*)"$/, "$1");
  const upsert = (key: string, value: string) =>
    db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });

  if (!dir) {
    await db.delete(schema.settings).where(inArray(schema.settings.key, inboxKeys));
    stopInboxWatcher();
    return done();
  }
  if (!isAbsolute(dir)) return { ok: false, error: "Enter the folder's full path, starting with a drive letter." };
  // The inbox reads and moves files, so it must be a folder inside the user's home folder.
  const home = homedir();
  let folderPath = resolve(dir);
  if (process.platform === "win32" && folderPath.toLowerCase().startsWith(`${home.toLowerCase()}${sep}`)) {
    folderPath = home + folderPath.slice(home.length); // Windows paths are case-insensitive
  }
  if (!folderPath.startsWith(home + sep)) {
    return { ok: false, error: `Choose a folder inside ${home}, for example a "ledger-inbox" folder in Downloads.` };
  }
  const ok = await stat(folderPath).then((s) => s.isDirectory(), () => false);
  if (!ok) return { ok: false, error: "That folder doesn't exist. Create it first." };
  if (!accountId || !(await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))) {
    return { ok: false, error: "Choose the account these files belong to." };
  }
  await upsert("inboxFolder", folderPath);
  await upsert("inboxAccountId", String(accountId));
  await startInboxWatcher();
  return done();
}
