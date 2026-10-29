/**
 * Fills the local database with ~4 months of realistic sample trades.
 * Wipes existing data first. Run with: npm run db:seed
 */
import { rm } from "node:fs/promises";
import { db, schema } from "../src/db";
import { dayKey } from "../src/lib/stats";

// Deterministic PRNG so the sample data is stable between runs.
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

// Separate stream for journal text so trade data stays identical between versions.
let jstate = 7;
const jrand = () => {
  jstate = (jstate * 1664525 + 1013904223) % 2 ** 32;
  return jstate / 2 ** 32;
};
const jpick = <T,>(xs: readonly T[]) => xs[Math.floor(jrand() * xs.length)];

const goodDays = [
  "Waited for the opening range to set before trading. Took only A setups and stopped after my second winner.",
  "Patient morning. Let the VWAP reclaim confirm on volume instead of anticipating it. Sized normally.",
  "Followed the plan: two trades, both with defined stops. Didn't trade the lunch chop.",
  "Good read on the trend. Scaled out at targets and left a runner. Calm the whole session.",
  "Small green day but clean execution. Skipped three setups that didn't meet my criteria.",
];
const badDays = [
  "Chased the first move after missing the entry. Should have waited for a pullback.",
  "Moved my stop on a loser hoping it would come back. It didn't. Stop is the stop.",
  "Oversized after a loss trying to make it back. Need a hard rule: size down after two losses.",
  "Traded through lunch out of boredom. Gave back the morning gains.",
  "Revenge traded after the first stop-out. Walk away after two losses in a row.",
];

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
  await db.delete(schema.playbooks);
  await db.delete(schema.screenshots);
  await rm("data/screenshots", { recursive: true, force: true });
  await db.delete(schema.tradeTags);
  await db.delete(schema.executions);
  await db.delete(schema.imports);
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
    let mistakeToday = false;
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
      if (!win && rand() < 0.35) {
        tagIds.push(pick(mistakeIds));
        mistakeToday = true;
      }
      await db.insert(schema.tradeTags).values(tagIds.map((tagId) => ({ tradeId: trade.id, tagId })));
      tradeCount++;
    }

    if (jrand() < 0.7) {
      await db.insert(schema.journalEntries).values({
        day: dayKey(day),
        content: jpick(mistakeToday ? badDays : goodDays),
        followedRules: !mistakeToday,
      });
    }
  }

  const byName = new Map(tagRows.map((t) => [t.name, t.id]));
  await db.insert(schema.playbooks).values([
    {
      title: "Opening range breakout",
      tagId: byName.get("Opening range breakout"),
      content: `When: first 30 minutes, after the 5-minute opening range is set.

Entry
- Break and close above the range high (long) or below the low (short)
- Relative volume above 1.5x
- Index futures moving the same way

Stop: other side of the range, or the breakout candle's low if the range is wide.
Target: 2R first, trail the rest under 5-minute higher lows.

Skip if: the range is wider than the day's average true range / 3, or there's news within 15 minutes.`,
    },
    {
      title: "VWAP reclaim",
      tagId: byName.get("VWAP reclaim"),
      content: `When: a stock that sold off early reclaims VWAP and holds it for two 5-minute closes.

Entry on the first pullback that holds VWAP.
Stop below VWAP by a small buffer.
Target: high of day, then trail.`,
    },
    {
      title: "Daily rules",
      content: `1. Max 4 trades a day.
2. Stop trading after two losses in a row.
3. Never move a stop further away.
4. Size down after a red day.
5. No trades 11:30 to 13:30 unless it's an A setup.`,
    },
  ]);

  console.log(`Seeded ${tradeCount} trades.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
