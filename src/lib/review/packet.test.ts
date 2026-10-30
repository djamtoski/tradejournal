import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPacket, reviewRange, type PacketInput } from "./packet";
import { streaks } from "../goals/evaluate";
import type { JournalTrade } from "../trades/load";

const NY = "America/New_York";
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00-04:00`);

const trade = (p: Partial<JournalTrade> & { netPnl: number; open: string; close: string }): JournalTrade => {
  const day = p.day ?? "2026-10-28";
  return {
    id: Math.random(), symbol: "NQZ6", side: "long", assetClass: "future", quantity: 1, entryPrice: 21000, exitPrice: 21010,
    fees: 4.5, grossPnl: p.netPnl + 4.5, followedRules: null, note: null, accountId: 1, multiplier: 20, stopPrice: null,
    targetPrice: null, tags: [], mistakes: [], day, openHour: 9, openWeekday: 3, risk: null,
    openedAt: at(day, p.open), closedAt: at(day, p.close), ...p,
  };
};

const base = (p: Partial<PacketInput>): PacketInput => ({
  period: "day", start: "2026-10-28", end: "2026-10-29", timezone: NY, trades: [], baseline: [], journal: [],
  goals: [], breaches: new Map(), streaks: streaks([]), playbooks: [], ...p,
});

test("week ranges start on Monday", () => {
  assert.deepEqual(reviewRange("week", "2026-10-29"), { start: "2026-10-26", end: "2026-11-02" });
  assert.deepEqual(reviewRange("day", "2026-10-29"), { start: "2026-10-29", end: "2026-10-30" });
});

test("day packet lists trades in open order with tags, R, rules and notes", () => {
  const md = buildPacket(base({
    trades: [
      trade({ netPnl: -500, open: "12:09", close: "12:21", risk: 500, mistakes: ["Chased entry"], followedRules: false, note: "FOMO | again" }),
      trade({ netPnl: 1000, open: "09:36", close: "09:52", risk: 500, tags: ["Opening range breakout"], followedRules: true }),
    ],
    journal: [{ day: "2026-10-28", content: "Chased after the open.", followedRules: false }],
    playbooks: [
      { title: "Daily rules", content: "Max 4 trades.", tag: null },
      { title: "ORB", content: "Wait for the range.", tag: "Opening range breakout" },
      { title: "VWAP reclaim", content: "Not traded today.", tag: "VWAP reclaim" },
    ],
  }));
  assert.match(md, /# Trading review packet: Wed, Oct 28, 2026/);
  assert.match(md, /Net P&L \+\$500\.00/);
  assert.match(md, /R: \+1\.0R total/);
  const rows = md.split("\n").filter((l) => l.startsWith("| 09:36") || l.startsWith("| 12:09"));
  assert.equal(rows.length, 2);
  assert.ok(rows[0].startsWith("| 09:36"));
  assert.match(rows[1], /Chased entry \| broke \| FOMO \/ again \|/); // pipes in notes can't break the table
  assert.match(md, /rated: broke my rules/);
  assert.match(md, /### Daily rules/);
  assert.match(md, /### ORB \(setup: Opening range breakout\)/);
  assert.doesNotMatch(md, /VWAP reclaim/);
});

test("empty day still reports goals, streaks and journal", () => {
  const md = buildPacket(base({ goals: [{ id: 1, kind: "max_trades_per_day", period: "day", value: 4, accountId: null, active: true }] }));
  assert.match(md, /No closed trades in this period/);
  assert.match(md, /Daily limits: Max 4 trades a day/);
  assert.match(md, /No limits were broken/);
  assert.match(md, /Within limits: 0 \/ 0 days/);
  assert.match(md, /No journal entries/);
});
