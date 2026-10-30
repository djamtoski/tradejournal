import { connection } from "next/server";
import { db, schema } from "@/db";

/** Full JSON snapshot of every table, for backups and moving between machines. */
export async function GET() {
  await connection();
  const [accounts, imports, executions, trades, tagGroups, tags, tradeTags, journalEntries, playbooks, screenshots, goals, settings, reviews] =
    await Promise.all([
      db.select().from(schema.accounts),
      db.select().from(schema.imports),
      db.select().from(schema.executions),
      db.select().from(schema.trades),
      db.select().from(schema.tagGroups),
      db.select().from(schema.tags),
      db.select().from(schema.tradeTags),
      db.select().from(schema.journalEntries),
      db.select().from(schema.playbooks),
      db.select().from(schema.screenshots),
      db.select().from(schema.goals),
      db.select().from(schema.settings),
      db.select().from(schema.reviews),
    ]);

  const body = JSON.stringify(
    {
      app: "ledger",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { accounts, imports, executions, trades, tagGroups, tags, tradeTags, journalEntries, playbooks, screenshots, goals, settings, reviews },
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
