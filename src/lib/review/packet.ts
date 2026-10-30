/**
 * The review packet: a compact markdown summary of one day or week that the
 * /review-trades skill reads before writing a review. Pure, so it's testable;
 * scripts/review-data.ts loads the data and prints the result.
 */
import { formatPct, formatPnl, formatR, formatRatio } from "../format";
import { goalLabel, isLimit, type Breach, type Goal, type Streak, type StreakId, streakKinds } from "../goals/evaluate";
import { byHour, byTag, rOf, summarize, weekStart } from "../stats";
import type { JournalTrade } from "../trades/load";
import { addDaysKey, formatTime } from "../tz";

export type ReviewPeriod = "day" | "week";

export type PacketInput = {
  period: ReviewPeriod;
  /** First day, and the exclusive end day. */
  start: string;
  end: string;
  timezone: string;
  trades: JournalTrade[];
  /** The 30 calendar days before `start`, for comparison. */
  baseline: JournalTrade[];
  journal: { day: string; content: string; followedRules: boolean | null }[];
  goals: Goal[];
  breaches: Map<string, Breach[]>;
  streaks: Record<StreakId, Streak>;
  playbooks: { title: string; content: string; tag: string | null }[];
};

const PLAYBOOK_CHARS = 1500;
const NOTE_CHARS = 300;

const longDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const cellText = (s: string) => oneLine(s).replace(/\|/g, "/");

function minutes(a: Date, b: Date) {
  const m = Math.round((b.getTime() - a.getTime()) / 60_000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

function summaryLines(trades: JournalTrade[]) {
  const s = summarize(trades, "net");
  const gross = trades.reduce((t, x) => t + x.grossPnl, 0);
  const fees = trades.reduce((t, x) => t + x.fees, 0);
  return [
    `- Net P&L ${formatPnl(s.total, true)} (gross ${formatPnl(gross, true)}, fees ${formatPnl(-fees, true)})`,
    `- ${s.count} trades over ${s.tradingDays} trading ${s.tradingDays === 1 ? "day" : "days"}: ${s.wins} ${s.wins === 1 ? "win" : "wins"}, ${s.losses} ${s.losses === 1 ? "loss" : "losses"}, win rate ${formatPct(s.winRate, 0)}`,
    `- Profit factor ${formatRatio(s.profitFactor)}, average win ${formatPnl(s.avgWin)}, average loss ${formatPnl(-s.avgLoss)}`,
    s.rCount
      ? `- R: ${formatR(s.totalR)} total, ${formatR(s.avgR, 2)} average over ${s.rCount} trades with a risk`
      : "- R: no trades have a stop or a default 1R, so there are no R-multiples",
  ];
}

function comparison(trades: JournalTrade[], baseline: JournalTrade[]) {
  if (!baseline.length) return ["- No trades in the previous 30 days to compare with."];
  const now = summarize(trades, "net");
  const before = summarize(baseline, "net");
  const perDay = (s: ReturnType<typeof summarize>) => (s.tradingDays ? s.count / s.tradingDays : 0);
  const avgDay = (s: ReturnType<typeof summarize>) => (s.tradingDays ? s.total / s.tradingDays : 0);
  const row = (label: string, a: string, b: string) => `| ${label} | ${a} | ${b} |`;
  return [
    "| | This period | Previous 30 days |",
    "|---|---|---|",
    row("Trades per day", perDay(now).toFixed(1), perDay(before).toFixed(1)),
    row("Average day", formatPnl(avgDay(now)), formatPnl(avgDay(before))),
    row("Win rate", formatPct(now.winRate, 0), formatPct(before.winRate, 0)),
    row("Average R", formatR(now.avgR, 2), formatR(before.avgR, 2)),
    row("Green days", `${now.greenDays}/${now.tradingDays}`, `${before.greenDays}/${before.tradingDays}`),
  ];
}

function tradeTable(trades: JournalTrade[], timezone: string, withDay: boolean) {
  const head = `| ${withDay ? "Day | " : ""}Open | Hold | Symbol | Side | Qty | Entry | Exit | Net | R | Setup | Mistakes | Rules | Note |`;
  const rule = `|${withDay ? "---|" : ""}---|---|---|---|---|---|---|---|---|---|---|---|---|`;
  const rows = [...trades]
    .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())
    .map((t) => {
      const cells = [
        ...(withDay ? [t.day.slice(5)] : []),
        formatTime(t.openedAt, timezone),
        minutes(t.openedAt, t.closedAt),
        t.symbol,
        t.side,
        t.quantity.toLocaleString("en-US"),
        t.entryPrice.toString(),
        t.exitPrice?.toString() ?? "",
        formatPnl(t.netPnl, true),
        formatR(rOf(t, "net"), 2),
        cellText(t.tags.join(", ")),
        cellText(t.mistakes.join(", ")),
        t.followedRules === true ? "followed" : t.followedRules === false ? "broke" : "",
        t.note ? cellText(clip(t.note, NOTE_CHARS)) : "",
      ];
      return `| ${cells.join(" | ")} |`;
    });
  return [head, rule, ...rows];
}

function breakdownLines(rows: { key: string; pnl: number; trades: number; winRate: number }[]) {
  return rows.filter((r) => r.trades > 0).map((r) => `- ${r.key}: ${formatPnl(r.pnl)} over ${r.trades} (${formatPct(r.winRate, 0)} wins)`);
}

export function buildPacket(input: PacketInput): string {
  const { period, start, end, timezone, trades } = input;
  const last = addDaysKey(end, -1);
  const title = period === "day" ? longDay(start) : `week of ${longDay(start)} to ${longDay(last)}`;
  const out: string[] = [`# Trading review packet: ${title}`, "", `Times are in ${timezone}. P&L is net of fees unless noted.`, ""];

  out.push("## Summary", "");
  if (!trades.length) {
    out.push("No closed trades in this period.", "");
  } else {
    out.push(...summaryLines(trades), "");
    out.push("## Compared with the previous 30 days", "", ...comparison(trades, input.baseline), "");
    out.push("## Trades", "", ...tradeTable(trades, timezone, period === "week"), "");
    if (period === "week") {
      out.push("## By setup", "", ...breakdownLines(byTag(trades, "net")), "");
      out.push("## By entry hour", "", ...breakdownLines(byHour(trades, "net")), "");
    }
  }

  const limits = input.goals.filter((g) => g.active && isLimit(g));
  const targets = input.goals.filter((g) => g.active && !isLimit(g));
  out.push("## Goals", "");
  if (!limits.length && !targets.length) out.push("No goals are set.");
  if (limits.length) out.push(`Daily limits: ${limits.map(goalLabel).join("; ")}.`);
  if (targets.length) out.push(`Profit targets: ${targets.map(goalLabel).join("; ")}.`);
  const breachDays = [...input.breaches].filter(([day]) => day >= start && day < end).sort(([a], [b]) => (a < b ? -1 : 1));
  if (limits.length) {
    out.push("", breachDays.length ? "Breaches:" : "No limits were broken in this period.");
    for (const [day, list] of breachDays) {
      for (const b of list) out.push(`- ${period === "week" ? `${day} ` : ""}${formatTime(b.at, timezone)}: ${b.text}`);
    }
  }
  out.push("", "Streaks at the end of this period (current / best):");
  for (const k of streakKinds) out.push(`- ${k.label}: ${input.streaks[k.id].current} / ${input.streaks[k.id].longest} ${k.unit}`);
  out.push("");

  out.push("## Journal", "");
  if (!input.journal.length) out.push("No journal entries in this period.");
  for (const j of input.journal) {
    const rating = j.followedRules === true ? " (rated: followed my rules)" : j.followedRules === false ? " (rated: broke my rules)" : "";
    out.push(`### ${longDay(j.day)}${rating}`, "", j.content.trim() || "(empty)", "");
  }
  out.push("");

  // Rules documents without a setup tag always apply; setup playbooks only when that setup was traded.
  const traded = new Set(trades.flatMap((t) => t.tags));
  const books = input.playbooks.filter((p) => !p.tag || traded.has(p.tag));
  out.push("## Playbook", "");
  if (!books.length) out.push("No playbook entries apply.");
  for (const p of books) out.push(`### ${p.title}${p.tag ? ` (setup: ${p.tag})` : ""}`, "", clip(p.content.trim(), PLAYBOOK_CHARS), "");

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/** The [start, end) day keys for a review; a week always starts on its Monday. */
export function reviewRange(period: ReviewPeriod, day: string) {
  const start = period === "week" ? weekStart(day) : day;
  return { start, end: addDaysKey(start, period === "week" ? 7 : 1) };
}
