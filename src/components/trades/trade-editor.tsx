"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTag, setTradeTags, updateTrade } from "@/lib/trades/actions";

type Tag = { id: number; name: string; groupId: number | null; group: string | null };

export function TradeEditor({
  tradeId,
  side,
  entryPrice,
  quantity,
  multiplier,
  allTags,
  groups,
  initial,
}: {
  tradeId: number;
  side: "long" | "short";
  entryPrice: number;
  quantity: number;
  multiplier: number;
  allTags: Tag[];
  groups: { id: number; name: string }[];
  initial: {
    tagIds: number[];
    note: string;
    followedRules: boolean | null;
    mfe: number | null;
    mae: number | null;
    stopPrice: number | null;
    targetPrice: number | null;
  };
}) {
  const [tagIds, setTagIds] = useState(initial.tagIds);
  const [tags, setTags] = useState(allTags);
  const [note, setNote] = useState(initial.note);
  const savedNote = useRef(initial.note);
  const [followedRules, setFollowedRules] = useState(initial.followedRules);
  const [nums, setNums] = useState({
    stopPrice: initial.stopPrice?.toString() ?? "",
    targetPrice: initial.targetPrice?.toString() ?? "",
    mfe: initial.mfe?.toString() ?? "",
    mae: initial.mae?.toString() ?? "",
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (label: string, fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      setSaved(label);
    });

  const toggleTag = (id: number) => {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    setTagIds(next);
    run("Tags saved", () => setTradeTags(tradeId, next));
  };

  const saveNumber = (key: keyof typeof nums, input: string) => {
    const raw = input.trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    run("Saved", () => updateTrade(tradeId, { [key]: value }));
  };

  // Planned risk in money and R-multiple of the realized move, when a stop is set.
  const stop = Number(nums.stopPrice);
  const risk = nums.stopPrice && Number.isFinite(stop) ? Math.abs(entryPrice - stop) * quantity * multiplier : null;

  const byGroup = new Map<string, Tag[]>();
  for (const t of tags) byGroup.set(t.group ?? "Other", [...(byGroup.get(t.group ?? "Other") ?? []), t]);

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-2">
      <Section title="Followed my rules">
        <div className="flex h-7 w-fit items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={followedRules === v}
              onClick={() => {
                const next = followedRules === v ? null : v;
                setFollowedRules(next);
                run("Saved", () => updateTrade(tradeId, { followedRules: next }));
              }}
              className={cn(
                "flex h-full items-center gap-1 rounded-[5px] px-2 text-[12px] transition-colors",
                followedRules === v
                  ? v ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                  : "text-faint hover:text-foreground",
              )}
            >
              {v ? <Check className="size-3.5" strokeWidth={2} /> : <X className="size-3.5" strokeWidth={2} />}
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Tags">
        <div className="flex flex-col gap-3">
          {[...byGroup.entries()].map(([group, list]) => (
            <div key={group} className="flex flex-col gap-1.5">
              <span className="text-[11px] text-faint">{group}</span>
              <div className="flex flex-wrap gap-1.5">
                {list.map((t) => {
                  const on = tagIds.includes(t.id);
                  const mistake = /^mistakes?$/i.test(group);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        "h-6 rounded-md border px-2 text-[12px] transition-colors",
                        on
                          ? mistake
                            ? "border-loss/40 bg-loss/10 text-loss"
                            : "border-primary/50 bg-primary/15 text-foreground"
                          : "border-input text-muted-foreground hover:border-faint hover:text-foreground",
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <NewTag
            groups={groups}
            onCreate={async (name, groupId) => {
              const res = await createTag(name, groupId);
              if (!res.ok) return res.error;
              const group = groups.find((g) => g.id === groupId)?.name ?? null;
              if (!tags.some((t) => t.id === res.id)) setTags([...tags, { id: res.id, name: name.trim(), groupId, group }]);
              if (!tagIds.includes(res.id)) toggleTag(res.id);
              return null;
            }}
          />
        </div>
      </Section>

      <Section title="Risk">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Stop" value={nums.stopPrice} onChange={(v) => setNums({ ...nums, stopPrice: v })} onCommit={(v) => saveNumber("stopPrice", v)} />
          <NumberField label="Target" value={nums.targetPrice} onChange={(v) => setNums({ ...nums, targetPrice: v })} onCommit={(v) => saveNumber("targetPrice", v)} />
          <NumberField label="MFE (points)" value={nums.mfe} onChange={(v) => setNums({ ...nums, mfe: v })} onCommit={(v) => saveNumber("mfe", v)} />
          <NumberField label="MAE (points)" value={nums.mae} onChange={(v) => setNums({ ...nums, mae: v })} onCommit={(v) => saveNumber("mae", v)} />
        </div>
        {risk !== null && risk > 0 && (
          <p className="num mt-2 text-[12px] text-faint">
            Planned risk ${risk.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            {side === "long" ? (stop > entryPrice ? " · stop is above entry" : "") : stop < entryPrice ? " · stop is below entry" : ""}
          </p>
        )}
      </Section>

      <Section title="Notes">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={(e) => {
            const value = e.currentTarget.value;
            if (value !== savedNote.current) {
              savedNote.current = value;
              run("Note saved", () => updateTrade(tradeId, { note: value }));
            }
          }}
          placeholder="Why did you take it? How did you manage it?"
          className="min-h-[120px] resize-y rounded-md border border-input bg-background px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-faint focus:border-primary"
        />
      </Section>

      <span className="h-4 text-right text-[12px] text-faint" aria-live="polite">
        {pending ? "Saving…" : saved}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-faint">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="num h-8 rounded-md border border-input bg-background px-2.5 text-[13px] outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

function NewTag({
  groups,
  onCreate,
}: {
  groups: { id: number; name: string }[];
  onCreate: (name: string, groupId: number | null) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(groups[0]?.id ?? null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-fit items-center gap-1 text-[12px] text-faint hover:text-foreground">
        <Plus className="size-3.5" strokeWidth={1.5} /> New tag
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const error = await onCreate(name, groupId);
        if (error) return setErr(error);
        setName("");
        setOpen(false);
      }}
    >
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tag name"
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary"
        />
        <select
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-[12px] outline-none focus:border-primary"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
          <option value="">No group</option>
        </select>
        <button type="submit" className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground">Add</button>
      </div>
      {err && <span className="text-[12px] text-loss">{err}</span>}
    </form>
  );
}
