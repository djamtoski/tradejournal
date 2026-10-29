"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

export const inputCls =
  "h-7 rounded-md border border-input bg-background px-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary";

const iconBtn =
  "grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

/** Text that turns into an input on edit. */
export function InlineEdit({
  value,
  onSave,
  className,
  label,
}: {
  value: string;
  onSave: (v: string) => Promise<Result>;
  className?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (draft.trim() === value) return setEditing(false);
      const res = await onSave(draft);
      if (!res.ok) return setError(res.error);
      setError(null);
      setEditing(false);
    });

  if (!editing) {
    return (
      <span className={cn("group/edit inline-flex min-w-0 items-center gap-1", className)}>
        <span className="truncate">{value}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="grid size-6 shrink-0 place-items-center rounded text-faint opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/edit:opacity-100"
          aria-label={`Rename ${label}`}
        >
          <Pencil className="size-3" strokeWidth={1.5} />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={`New name for ${label}`}
          className={cn(inputCls, "w-48")}
        />
        <button type="button" disabled={pending} onClick={submit} className={iconBtn} aria-label="Save">
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

/** Trash icon that asks once before running. */
export function ConfirmDelete({
  label,
  warning,
  onConfirm,
}: {
  label: string;
  warning: string;
  onConfirm: () => Promise<Result>;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={iconBtn} aria-label={`Delete ${label}`}>
        <Trash2 className="size-3.5" strokeWidth={1.5} />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[12px]">
      <span className="text-muted-foreground">{warning}</span>
      <button
        type="button"
        disabled={pending}
        className="text-loss hover:underline"
        onClick={() => start(async () => void (await onConfirm()))}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" className="text-faint hover:text-foreground" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

/** "+ Add" link that opens a one-field form. */
export function AddInline({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (v: string) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-fit items-center gap-1 text-[12px] text-faint hover:text-foreground">
        <Plus className="size-3.5" strokeWidth={1.5} /> {label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await onAdd(v);
          if (!res.ok) return setError(res.error);
          setV("");
          setError(null);
          setOpen(false);
        });
      }}
    >
      <span className="flex items-center gap-1">
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={cn(inputCls, "w-48")} />
        <button type="submit" disabled={pending} className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50">
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className={iconBtn} aria-label="Cancel">
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </span>
      {error && <span className="text-[12px] text-loss">{error}</span>}
    </form>
  );
}
