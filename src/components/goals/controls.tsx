"use client";

import { useState, useTransition } from "react";
import { Check, Pause, Pencil, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDelete, inputCls } from "@/components/settings/controls";
import { createGoal, deleteGoal, setGoalActive, updateGoalValue } from "@/lib/goals/actions";
import { goalKindOptions, goalPeriodOptions, type GoalKind, type GoalPeriod } from "@/lib/goals/evaluate";

const iconBtn =
  "grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

/** Edit amount, pause/resume and delete for one goal. */
export function GoalActions({ id, value, active, label }: { id: number; value: number; active: boolean; label: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateGoalValue(id, draft);
      if (!res.ok) return setError(res.error);
      setError(null);
      setEditing(false);
    });

  if (editing) {
    return (
      <span className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1">
          <input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={`New amount for ${label}`}
            className={cn(inputCls, "num w-24 text-right")}
          />
          <button type="button" disabled={pending} onClick={save} className={iconBtn} aria-label="Save">
            <Check className="size-3.5" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => setEditing(false)} className={iconBtn} aria-label="Cancel">
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </span>
        {error && <span className="text-[12px] text-loss">{error}</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center">
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className={iconBtn}
        aria-label={`Edit ${label}`}
      >
        <Pencil className="size-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await setGoalActive(id, !active)))}
        className={iconBtn}
        aria-label={active ? `Pause ${label}` : `Resume ${label}`}
        title={active ? "Pause" : "Resume"}
      >
        {active ? <Pause className="size-3.5" strokeWidth={1.5} /> : <Play className="size-3.5" strokeWidth={1.5} />}
      </button>
      <ConfirmDelete label={label} warning="Delete this goal?" onConfirm={() => deleteGoal(id)} />
    </span>
  );
}

const selectCls = cn(inputCls, "h-8 pr-6");

/** One-line form: type, period (targets only), amount, account. */
export function AddGoalForm({ accounts }: { accounts: { id: number; name: string }[] }) {
  const [kind, setKind] = useState<GoalKind>("max_trades_per_day");
  const [period, setPeriod] = useState<GoalPeriod>("day");
  const [value, setValue] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unit = goalKindOptions.find((o) => o.id === kind)!.unit;

  return (
    <form
      className="flex flex-col gap-2 px-4 pb-4 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createGoal({
            kind,
            period,
            value: Number(value.replace(/[$,\s]/g, "")),
            accountId: accountId ? Number(accountId) : null,
          });
          if (!res.ok) return setError(res.error);
          setError(null);
          setValue("");
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Goal type" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)} className={selectCls}>
          {goalKindOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {kind === "profit_target" && (
          <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)} className={selectCls}>
            {goalPeriodOptions.map((o) => (
              <option key={o.id} value={o.id}>per {o.label.toLowerCase()}</option>
            ))}
          </select>
        )}
        <span className="relative">
          {unit === "$" && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-faint">$</span>}
          <input
            inputMode={unit === "$" ? "decimal" : "numeric"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={unit === "$" ? "1,000" : "4"}
            aria-label="Amount"
            className={cn(inputCls, "num h-8 w-28", unit === "$" && "pl-5")}
          />
        </span>
        {accounts.length > 1 && (
          <select aria-label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add goal"}
        </button>
      </div>
      {error && <span className="text-[12px] text-loss">{error}</span>}
    </form>
  );
}
