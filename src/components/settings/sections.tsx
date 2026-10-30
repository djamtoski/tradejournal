"use client";

import { useState, useTransition } from "react";
import {
  createTagGroup,
  createTagInGroup,
  deleteAccount,
  deleteTag,
  deleteTagGroup,
  eraseAllData,
  renameAccount,
  renameTagGroup,
  setAccountRisk,
  updateTag,
} from "@/lib/settings/actions";
import { AddInline, ConfirmDelete, InlineEdit, inputCls } from "./controls";
import { cn } from "@/lib/utils";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

type Account = { id: number; name: string; broker: string | null; trades: number; imports: number; defaultRisk: number | null };

export function AccountsSection({ accounts }: { accounts: Account[] }) {
  if (!accounts.length) {
    return <p className="px-4 pb-4 pt-1 text-[13px] text-faint">Accounts are created when you import trades.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {accounts.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 flex-col">
            <InlineEdit
              label={a.name}
              value={a.name}
              className="text-[13px] text-foreground"
              onSave={(name) => renameAccount(a.id, name, a.broker ?? "")}
            />
            <span className="num text-[12px] text-faint">
              {a.broker ? `${a.broker} · ` : ""}
              {plural(a.trades, "trade")} · {plural(a.imports, "import")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <RiskInput accountId={a.id} accountName={a.name} initial={a.defaultRisk} />
            <ConfirmDelete
            label={a.name}
            warning={a.trades ? `Delete ${a.name} and its ${plural(a.trades, "trade")}?` : `Delete ${a.name}?`}
            onConfirm={() => deleteAccount(a.id)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "1R = $___" for trades in this account that have no stop. Saves on blur or Enter. */
function RiskInput({ accountId, accountName, initial }: { accountId: number; accountName: string; initial: number | null }) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [saved, setSaved] = useState(value);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const commit = (raw: string) => {
    if (raw.trim() === saved.trim()) return;
    start(async () => {
      const res = await setAccountRisk(accountId, raw);
      if (!res.ok) return setStatus(res.error);
      setSaved(raw);
      setStatus("Saved");
    });
  };

  return (
    <label className="flex items-center gap-2 text-[12px] text-muted-foreground" title="Used as 1R for trades without a stop">
      1R
      <span className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint">$</span>
        <input
          inputMode="decimal"
          value={value}
          placeholder="—"
          aria-label={`Default risk per trade for ${accountName}`}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus(null);
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={cn(inputCls, "num w-24 pl-5")}
        />
      </span>
      <span className={cn("w-12 text-[11px]", status && status !== "Saved" ? "text-loss" : "text-faint")} aria-live="polite">
        {pending ? "…" : status}
      </span>
    </label>
  );
}

type Tag = { id: number; name: string; groupId: number | null; uses: number };
type Group = { id: number; name: string };

export function TagsSection({ groups, tags }: { groups: Group[]; tags: Tag[] }) {
  const sections: { group: Group | null; tags: Tag[] }[] = [
    ...groups.map((g) => ({ group: g, tags: tags.filter((t) => t.groupId === g.id) })),
    { group: null, tags: tags.filter((t) => t.groupId === null) },
  ];

  return (
    <div className="flex flex-col">
      {sections.map(({ group, tags: list }) =>
        !group && !list.length ? null : (
          <div key={group?.id ?? "none"} className="border-b border-border px-4 py-3 last:border-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              {group ? (
                <InlineEdit
                  label={`${group.name} group`}
                  value={group.name}
                  className="text-[13px] font-medium text-foreground"
                  onSave={(name) => renameTagGroup(group.id, name)}
                />
              ) : (
                <span className="text-[13px] font-medium text-muted-foreground">Ungrouped</span>
              )}
              {group && (
                <ConfirmDelete
                  label={`${group.name} group`}
                  warning="Delete group? Its tags stay, ungrouped."
                  onConfirm={() => deleteTagGroup(group.id)}
                />
              )}
            </div>
            <ul className="flex flex-col">
              {list.map((t) => (
                <TagRow key={t.id} tag={t} groups={groups} />
              ))}
            </ul>
            <div className="mt-1.5">
              <AddInline
                label={group ? `Add tag to ${group.name}` : "Add ungrouped tag"}
                placeholder="Tag name"
                onAdd={(name) => createTagInGroup(name, group?.id ?? null)}
              />
            </div>
          </div>
        ),
      )}
      <div className="px-4 py-3">
        <AddInline label="New group" placeholder="Group name" onAdd={createTagGroup} />
      </div>
      <p className="border-t border-border px-4 py-2.5 text-[12px] text-faint">
        Tags in a group named “Mistake” are tracked separately on the dashboard as the cost of mistakes.
      </p>
    </div>
  );
}

function TagRow({ tag, groups }: { tag: Tag; groups: Group[] }) {
  const [, start] = useTransition();
  return (
    <li className="group flex h-9 items-center justify-between gap-3 rounded-md px-2 hover:bg-muted/50">
      <span className="flex min-w-0 items-center gap-2">
        <InlineEdit label={tag.name} value={tag.name} className="text-[13px]" onSave={(name) => updateTag(tag.id, { name })} />
        <span className="num shrink-0 text-[11px] text-faint">{tag.uses}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <select
          aria-label={`Move ${tag.name} to group`}
          value={tag.groupId ?? ""}
          onChange={(e) => start(async () => void (await updateTag(tag.id, { groupId: e.target.value ? Number(e.target.value) : null })))}
          className={cn(inputCls, "h-6 text-[12px] opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100")}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
          <option value="">Ungrouped</option>
        </select>
        <ConfirmDelete
          label={tag.name}
          warning={tag.uses ? `Remove from ${plural(tag.uses, "trade")}?` : "Delete tag?"}
          onConfirm={() => deleteTag(tag.id)}
        />
      </span>
    </li>
  );
}

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) return <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground">All data erased.</p>;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
      <p className="text-[13px] text-muted-foreground">
        Erase every account, trade, tag, journal entry, playbook and goal, for example to remove the sample data before
        importing your own. Download a backup first if you might want it back.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-8 w-fit rounded-md border border-loss/40 px-3 text-[13px] text-loss transition-colors hover:bg-loss/10"
        >
          Erase all data
        </button>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await eraseAllData(text);
              if (!res.ok) return setError(res.error);
              setDone(true);
            });
          }}
        >
          <label className="text-[12px] text-muted-foreground">
            Type <span className="num text-foreground">erase everything</span> to confirm
          </label>
          <div className="flex gap-2">
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={cn(inputCls, "h-8 w-56")} />
            <button
              type="submit"
              disabled={pending || text.trim().toLowerCase() !== "erase everything"}
              className="h-8 rounded-md bg-loss px-3 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
            >
              {pending ? "Erasing…" : "Erase all data"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 px-2 text-[13px] text-faint hover:text-foreground">
              Cancel
            </button>
          </div>
          {error && <span className="text-[12px] text-loss">{error}</span>}
        </form>
      )}
    </div>
  );
}
