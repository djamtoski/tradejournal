import "server-only";
import { watch, type FSWatcher } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings/queries";
import { importFills } from "./core";
import { detectPreset } from "./presets";

/**
 * The watched inbox: CSV exports dropped into a folder are imported into one
 * account, then moved to imported/ (or failed/ with a .reason.txt). Other CSVs
 * are left untouched. Only runs while the app is running; files added
 * meanwhile are picked up at start.
 */

export type InboxFileResult = { file: string; ok: boolean; message: string };
export type InboxRun = { at: number; results: InboxFileResult[] };

type InboxState = {
  watcher: FSWatcher | null;
  folder: string | null;
  error: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  queue: Promise<unknown>;
  last: InboxRun | null;
  /** CSVs that aren't broker exports, by name and modified time, so each is reported once and left alone. */
  ignored: Set<string>;
};

// One state per process: instrumentation and server actions load separate module copies.
const g = globalThis as typeof globalThis & { __ledgerInbox?: InboxState };
const state = (g.__ledgerInbox ??= { watcher: null, folder: null, error: null, timer: null, queue: Promise.resolve(), last: null, ignored: new Set() });
state.ignored ??= new Set(); // state created by an older version of this module

export const DONE_DIR = "imported";
export const FAILED_DIR = "failed";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isDirectory(dir: string) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** Moves a file into a subfolder, adding " (2)" etc. if the name is taken. */
async function moveInto(dir: string, sub: string, name: string) {
  const target = path.join(dir, sub);
  await mkdir(target, { recursive: true });
  const { name: base, ext } = path.parse(name);
  for (let n = 1; ; n++) {
    const candidate = path.join(target, n === 1 ? name : `${base} (${n})${ext}`);
    try {
      await stat(candidate);
    } catch {
      await rename(path.join(dir, name), candidate);
      return candidate;
    }
  }
}

/** Waits until the file stops growing, so half-written downloads aren't read. */
async function settled(file: string) {
  let size = -1;
  for (let i = 0; i < 10; i++) {
    const now = (await stat(file)).size;
    if (now === size && now > 0) return true;
    size = now;
    await sleep(400);
  }
  return false;
}

async function importFile(dir: string, name: string, accountId: number, timezone: string): Promise<InboxFileResult | null> {
  const fail = async (message: string): Promise<InboxFileResult> => {
    const moved = await moveInto(dir, FAILED_DIR, name);
    await writeFile(`${moved}.reason.txt`, `${new Date().toISOString()}\n${message}\n`);
    return { file: name, ok: false, message };
  };

  const full = path.join(dir, name);
  if (!(await settled(full))) return { file: name, ok: false, message: "Still being written; will retry on the next sync." };

  const { mtimeMs } = await stat(full);
  const seenKey = `${name}:${mtimeMs}`;
  if (state.ignored.has(seenKey)) return null;
  const text = (await readFile(full, "utf8")).replace(/^﻿/, "");
  const csv = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const preset = detectPreset((csv.meta.fields ?? []).filter(Boolean));
  if (!preset) {
    // Only recognised exports are ever moved; anything else in the folder stays where it is.
    state.ignored.add(seenKey);
    return { file: name, ok: false, message: "Not a recognised broker export, so it was left in place. Import it from the Import page instead." };
  }

  const parsed = preset.parse(csv.data, timezone);
  if (!parsed.executions.length) {
    return fail(parsed.errors.length ? `No fills could be read. First problem: row ${parsed.errors[0].row}, ${parsed.errors[0].message}.` : "The file has no filled orders.");
  }

  const res = await importFills({ accountId, broker: preset.broker, fileName: name, executions: parsed.executions, source: "inbox" });
  if (!res.ok) return fail(res.error);
  await moveInto(dir, DONE_DIR, name);

  const parts = [`${preset.label}: ${res.inserted} new ${res.inserted === 1 ? "fill" : "fills"}`];
  if (res.skipped) parts.push(`${res.skipped} already imported`);
  if (parsed.errors.length) parts.push(`${parsed.errors.length} unreadable ${parsed.errors.length === 1 ? "row" : "rows"} skipped`);
  return { file: name, ok: true, message: parts.join(", ") };
}

/** Imports every CSV waiting in the inbox. Runs are queued so the watcher and the button never overlap. */
export function syncInbox(): Promise<{ ok: true; run: InboxRun } | { ok: false; error: string }> {
  const run = state.queue.then(async () => {
    const { inboxFolder, inboxAccountId, timezone } = await getSettings();
    if (!inboxFolder || !inboxAccountId) return { ok: false as const, error: "Choose an inbox folder and account in Settings first." };
    if (!(await isDirectory(inboxFolder))) return { ok: false as const, error: `Folder not found: ${inboxFolder}` };
    const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, inboxAccountId) });
    if (!account) return { ok: false as const, error: "The inbox account no longer exists. Choose another in Settings." };

    const names = (await readdir(inboxFolder, { withFileTypes: true }))
      .filter((f) => f.isFile() && /\.csv$/i.test(f.name))
      .map((f) => f.name)
      .sort();
    const results: InboxFileResult[] = [];
    for (const name of names) {
      try {
        const result = await importFile(inboxFolder, name, inboxAccountId, timezone);
        if (result) results.push(result);
      } catch (err) {
        results.push({ file: name, ok: false, message: err instanceof Error ? err.message : "Import failed" });
      }
    }
    const done: InboxRun = { at: Date.now(), results };
    if (results.length) state.last = done;
    return { ok: true as const, run: done };
  });
  state.queue = run.catch(() => undefined);
  return run;
}

function scheduleSync() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    syncInbox()
      .then((res) => {
        if (!res.ok) return console.warn(`[inbox] ${res.error}`);
        for (const r of res.run.results) console.log(`[inbox] ${r.ok ? "imported" : "failed"} ${r.file}: ${r.message}`);
      })
      .catch((err) => console.error("[inbox]", err));
  }, 1000);
}

export function stopInboxWatcher() {
  state.watcher?.close();
  state.watcher = null;
  state.folder = null;
  state.error = null;
}

/** (Re)starts watching the configured folder and imports anything already waiting. */
export async function startInboxWatcher() {
  stopInboxWatcher();
  const { inboxFolder, inboxAccountId } = await getSettings();
  if (!inboxFolder || !inboxAccountId) return;
  if (!(await isDirectory(inboxFolder))) {
    state.error = "Folder not found";
    return;
  }
  // persistent: false so the watcher never keeps a build or script process alive.
  const watcher = watch(inboxFolder, { persistent: false }, (_event, file) => {
    if (file && /\.csv$/i.test(file.toString())) scheduleSync();
  });
  watcher.on("error", (err) => {
    stopInboxWatcher();
    state.error = err.message;
  });
  state.watcher = watcher;
  state.folder = inboxFolder;
  scheduleSync();
}

export function inboxStatus() {
  return { watching: !!state.watcher, folder: state.folder, error: state.error, last: state.last };
}
