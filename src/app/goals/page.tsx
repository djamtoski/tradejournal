import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/dashboard/card";
import { AddGoalForm, GoalActions } from "@/components/goals/controls";
import { StreakTiles } from "@/components/goals/streaks";
import { cn } from "@/lib/utils";
import { getAccounts } from "@/lib/queries";
import { getGoalHistory } from "@/lib/goals/queries";
import { goalLabel, isLimit, targetProgress, type DayStatus, type Goal, type GoalTrade } from "@/lib/goals/evaluate";
import { getSettings } from "@/lib/settings/queries";
import { addDaysKey, dayKey, formatTime } from "@/lib/tz";
import { weekStart } from "@/lib/stats";
import { formatMoney, formatPnl, pnlTone } from "@/lib/format";

export default function GoalsPage() {
  return (
    <Suspense fallback={<GoalsSkeleton />}>
      <Goals />
    </Suspense>
  );
}

/** How many recent trading days the limit cards and breach list look at. */
const RECENT_DAYS = 30;

async function Goals() {
  const [{ goals, trades, days, streaks }, accounts, { timezone }] = await Promise.all([
    getGoalHistory(),
    getAccounts(),
    getSettings(),
  ]);
  const today = dayKey(new Date(), timezone);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const limits = goals.filter(isLimit);
  const targets = goals.filter((g) => !isLimit(g));
  const recent = days.slice(-RECENT_DAYS);
  const breachDays = days.filter((d) => d.breaches.length).slice(-8).reverse();

  return (
    <>
      <PageHeader title="Goals">
        <span className="text-[12px] text-faint">All accounts · net P&L</span>
      </PageHeader>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-6">
        <StreakTiles streaks={streaks} hasLimits={limits.some((g) => g.active)} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Daily limits" meta={`Last ${recent.length} trading days`}>
            {limits.length ? (
              <ul className="divide-y divide-border">
                {limits.map((g) => (
                  <LimitRow key={g.id} goal={g} days={recent} account={g.accountId ? accountName.get(g.accountId) : undefined} />
                ))}
              </ul>
            ) : (
              <Empty>Limits keep a bad day small: a cap on trades, a max loss, a stop after losses in a row.</Empty>
            )}
          </Panel>
          <Panel title="Profit targets">
            {targets.length ? (
              <ul className="divide-y divide-border">
                {targets.map((g) => (
                  <TargetRow
                    key={g.id}
                    goal={g}
                    trades={trades}
                    today={today}
                    account={g.accountId ? accountName.get(g.accountId) : undefined}
                  />
                ))}
              </ul>
            ) : (
              <Empty>Set a P&L target per day, week or month to see how often you reach it.</Empty>
            )}
          </Panel>
        </div>

        <Panel title="Add a goal">
          <AddGoalForm accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title="Limits by day" meta="Last 12 weeks">
            <ComplianceGrid days={days} today={today} />
          </Panel>
          <Panel title="Recent breaches">
            {breachDays.length ? (
              <ul className="divide-y divide-border">
                {breachDays.map((d) => (
                  <li key={d.day}>
                    <Link href={`/daily?date=${d.day}`} className="flex flex-col gap-0.5 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/50">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="num text-foreground">{shortDay(d.day)}</span>
                        <span className={cn("num", pnlTone(d.pnl))}>{formatPnl(d.pnl)}</span>
                      </span>
                      {d.breaches.map((b) => (
                        <span key={b.goal.id} className="text-muted-foreground">
                          <span className="num text-faint">{formatTime(b.at, timezone)}</span> · {b.text}
                        </span>
                      ))}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{limits.length ? "No breaches yet. Keep it that way." : "Breaches of your daily limits show up here."}</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function GoalTitle({ goal, account }: { goal: Goal; account?: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className={goal.active ? "text-foreground" : "text-faint line-through"}>{goalLabel(goal)}</span>
      {account && <span className="text-[12px] text-faint">{account}</span>}
      {!goal.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Paused</span>}
    </span>
  );
}

function LimitRow({ goal, days, account }: { goal: Goal; days: DayStatus[]; account?: string }) {
  const broken = days.filter((d) => d.breaches.some((b) => b.goal.id === goal.id)).length;
  const kept = days.length - broken;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <GoalTitle goal={goal} account={account} />
        <GoalActions id={goal.id} value={goal.value} active={goal.active} label={goalLabel(goal)} />
      </div>
      <Bar pct={goal.active && days.length ? kept / days.length : 0} tone="bg-profit" />
      <span className="num text-[12px] text-faint">
        {!goal.active
          ? "Paused, so not checked"
          : days.length
            ? `Kept on ${kept} of ${days.length} days${broken ? ` · broken ${broken}×` : ""}`
            : "No trading days yet"}
      </span>
    </li>
  );
}

const periodName = { day: "Today", week: "This week", month: "This month" } as const;
const pastName = { day: "days", week: "weeks", month: "months" } as const;

function TargetRow({ goal, trades, today, account }: { goal: Goal; trades: GoalTrade[]; today: string; account?: string }) {
  const p = targetProgress(trades, goal, today);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <GoalTitle goal={goal} account={account} />
        <GoalActions id={goal.id} value={goal.value} active={goal.active} label={goalLabel(goal)} />
      </div>
      <Bar pct={p.pct} tone={!goal.active ? "bg-input" : p.hit ? "bg-profit" : "bg-primary"} />
      <span className="num flex flex-wrap justify-between gap-x-3 text-[12px] text-faint">
        <span>
          {periodName[goal.period]} <span className={pnlTone(p.pnl)}>{formatPnl(p.pnl)}</span> of {formatMoney(goal.value)}
          {p.hit && <span className="text-profit"> · reached</span>}
        </span>
        {p.pastPeriods > 0 && (
          <span>
            Hit {p.pastHits} of {p.pastPeriods} past {pastName[goal.period]}
          </span>
        )}
      </span>
    </li>
  );
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}

const shortDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
};

/** Twelve week columns, Monday on top: green kept every limit, red broke one, grey no trades. */
function ComplianceGrid({ days, today }: { days: DayStatus[]; today: string }) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const first = addDaysKey(weekStart(today), -7 * 11);
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDaysKey(first, w * 7 + i)));
  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
      <div className="flex gap-1">
        <div className="mr-1 grid grid-rows-7 gap-1 text-[10px] leading-none text-faint">
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((l, i) => (
            <span key={i} className="flex h-4 items-center">{l}</span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid flex-1 grid-rows-7 gap-1">
            {week.map((key) => {
              const d = byDay.get(key);
              const future = key > today;
              const cls = cn(
                "h-4 rounded-[3px]",
                future ? "bg-transparent" : !d ? "bg-muted" : d.breaches.length ? "bg-loss/70" : "bg-profit/70",
              );
              const title = d
                ? `${shortDay(key)} · ${d.breaches.length ? d.breaches.map((b) => b.text).join("; ") : "within limits"}`
                : undefined;
              return d ? (
                <Link key={key} href={`/daily?date=${key}`} title={title} className={cn(cls, "hover:ring-1 hover:ring-input")} />
              ) : (
                <span key={key} className={cls} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[12px] text-faint">
        <Legend cls="bg-profit/70">Within limits</Legend>
        <Legend cls="bg-loss/70">Broke a limit</Legend>
        <Legend cls="bg-muted">No trades</Legend>
      </div>
    </div>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", cls)} />
      {children}
    </span>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 pb-4 pt-1 text-[13px] text-faint">{children}</p>
);

function GoalsSkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[10px] border border-border bg-card" />
          ))}
        </div>
        <div className="h-[280px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
