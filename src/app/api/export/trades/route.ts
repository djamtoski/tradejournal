import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** All trades as CSV, one row per trade, with tags joined by "; ". */
export async function GET() {
  await connection();
  const [trades, accounts, tagRows] = await Promise.all([
    db.select().from(schema.trades).orderBy(asc(schema.trades.openedAt)),
    db.select().from(schema.accounts),
    db
      .select({ tradeId: schema.tradeTags.tradeId, name: schema.tags.name })
      .from(schema.tradeTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.tradeTags.tagId)),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const tags = new Map<number, string[]>();
  for (const r of tagRows) tags.set(r.tradeId, [...(tags.get(r.tradeId) ?? []), r.name]);

  const header = [
    "account", "symbol", "asset_class", "side", "quantity", "multiplier", "entry_price", "exit_price",
    "opened_at", "closed_at", "gross_pnl", "fees", "net_pnl", "mfe", "mae", "stop_price",
    "target_price", "followed_rules", "grade", "exit_reason", "tags", "note",
  ];
  const rows = trades.map((t) => [
    accountName.get(t.accountId) ?? "", t.symbol, t.assetClass, t.side, t.quantity, t.multiplier,
    t.entryPrice, t.exitPrice, t.openedAt.toISOString(), t.closedAt?.toISOString() ?? "",
    t.grossPnl, t.fees, t.netPnl, t.mfe, t.mae, t.stopPrice, t.targetPrice,
    t.followedRules === null ? "" : t.followedRules ? "yes" : "no",
    t.grade ?? "", t.exitReason ?? "",
    (tags.get(t.id) ?? []).join("; "), t.note ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-trades-${stamp()}.csv"`,
    },
  });
}

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Keep spreadsheet apps from treating text as a formula.
  if (/^[=+\-@]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const stamp = () => new Date().toISOString().slice(0, 10);
