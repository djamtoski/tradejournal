/**
 * Fills the local database with ~4 months of realistic sample trades.
 * Wipes existing data first. Run with: npm run db:seed
 */
import { db, schema } from "../src/db";

// Deterministic PRNG so the sample data is stable between runs.
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const instruments = [
  { symbol: "NQ", assetClass: "future", multiplier: 20, price: 20400, tick: 0.25, qty: [1, 2] },
  { symbol: "ES", assetClass: "future", multiplier: 50, price: 5900, tick: 0.25, qty: [1, 2, 3] },
  { symbol: "AAPL", assetClass: "stock", multiplier: 1, price: 228, tick: 0.01, qty: [50, 100, 200] },
  { symbol: "NVDA", assetClass: "stock", multiplier: 1, price: 138, tick: 0.01, qty: [100, 200] },
  { symbol: "TSLA", assetClass: "stock", multiplier: 1, price: 255, tick: 0.01, qty: [50, 100] },
  { symbol: "SPY", assetClass: "stock", multiplier: 1, price: 585, tick: 0.01, qty: [50, 100] },
] as const;

const setupTags = ["Opening range breakout", "VWAP reclaim", "Pullback", "Failed breakdown", "Trend continuation"];
const mistakeTags = ["Chased entry", "Moved stop", "Oversized"];

async function main() {
  await db.delete(schema.tradeTags);
  await db.delete(schema.executions);
  await db.delete(schema.trades);
  await db.delete(schema.tags);
  await db.delete(schema.tagGroups);
  await db.delete(schema.journalEntries);
  await db.delete(schema.accounts);

  const [account] = await db
    .insert(schema.accounts)
    .values({ name: "Main", broker: "Sample" })
    .returning();

  const [setups, mistakes] = await db
    .insert(schema.tagGroups)
    .values([
      { name: "Setup", color: "#5e6ad2" },
      { name: "Mistake", color: "#eb5757" },
    ])
    .returning();

  const tagRows = await db
    .insert(schema.tags)
    .values([
      ...setupTags.map((name) => ({ name, groupId: setups.id })),
      ...mistakeTags.map((name) => ({ name, groupId: mistakes.id })),
    ])
    .returning();
  const setupIds = tagRows.filter((t) => t.groupId === setups.id).map((t) => t.id);
  const mistakeIds = tagRows.filter((t) => t.groupId === mistakes.id).map((t) => t.id);

  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 4);

  let tradeCount = 0;
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6 || rand() < 0.1) continue;

    const tradesToday = 1 + Math.floor(rand() * 5);
    for (let i = 0; i < tradesToday; i++) {
      const inst = pick(instruments);
      const side = rand() < 0.6 ? "long" : "short";
      const qty = pick(inst.qty);
      const entry = +(inst.price * (1 + (rand() - 0.5) * 0.06)).toFixed(2);

      // Slight positive edge: 56% winners, winners ~1.4x the size of losers.
      const win = rand() < 0.56;
      const movePct = (win ? 0.0025 + rand() * 0.006 : -(0.002 + rand() * 0.004));
      const signed = side === "long" ? movePct : -movePct;
      const exit = +(Math.round((entry * (1 + signed)) / inst.tick) * inst.tick).toFixed(2);

      const opened = new Date(day);
      opened.setHours(9, 30 + Math.floor(rand() * 330), Math.floor(rand() * 60), 0);
      const holdMinutes = 1 + Math.floor(rand() * (rand() < 0.8 ? 25 : 120));
      const closed = new Date(opened.getTime() + holdMinutes * 60_000);

      const direction = side === "long" ? 1 : -1;
      const gross = +((exit - entry) * direction * qty * inst.multiplier).toFixed(2);
      const fees = +(inst.assetClass === "future" ? qty * 4.5 : qty * 0.005 + 1).toFixed(2);
      const mfe = +(Math.abs(exit - entry) * (win ? 1.3 : 0.4)).toFixed(2);
      const mae = +(Math.abs(exit - entry) * (win ? 0.35 : 1.1)).toFixed(2);

      const [trade] = await db
        .insert(schema.trades)
        .values({
          accountId: account.id,
          symbol: inst.symbol,
          assetClass: inst.assetClass,
          side,
          multiplier: inst.multiplier,
          quantity: qty,
          entryPrice: entry,
          exitPrice: exit,
          openedAt: opened,
          closedAt: closed,
          grossPnl: gross,
          fees,
          netPnl: +(gross - fees).toFixed(2),
          mfe,
          mae,
          followedRules: rand() < (win ? 0.85 : 0.6),
        })
        .returning({ id: schema.trades.id });

      const tagIds = [pick(setupIds)];
      if (!win && rand() < 0.35) tagIds.push(pick(mistakeIds));
      await db.insert(schema.tradeTags).values(tagIds.map((tagId) => ({ tradeId: trade.id, tagId })));
      tradeCount++;
    }
  }

  console.log(`Seeded ${tradeCount} trades.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
