"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePlaybook, updatePlaybook } from "@/lib/playbook/actions";

type Status = "idle" | "dirty" | "saving" | "saved";

export function PlaybookEditor({
  id,
  initialTitle,
  initialContent,
  initialTagId,
  setupTags,
}: {
  id: number;
  initialTitle: string;
  initialContent: string;
  initialTagId: number | null;
  setupTags: { id: number; name: string }[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tagId, setTagId] = useState(initialTagId);
  const [status, setStatus] = useState<Status>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; content?: string }>({});

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setStatus("saving");
    startTransition(async () => {
      await updatePlaybook(id, patch);
      setStatus("saved");
    });
  };

  const queue = (patch: { title?: string; content?: string }) => {
    pending.current = { ...pending.current, ...patch };
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  // Save anything pending when switching entries or leaving the page.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (Object.keys(pending.current).length) void updatePlaybook(id, pending.current);
      }
    },
    [id],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          aria-label="Title"
          className="min-w-0 flex-1 bg-transparent font-heading text-[20px] font-semibold tracking-tight text-foreground outline-none placeholder:text-faint"
          placeholder="Setup name"
        />
        <span className="mt-2 text-[12px] text-faint" aria-live="polite">
          {status === "dirty" && "Unsaved"}
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-muted-foreground">Linked setup tag</span>
        <select
          value={tagId ?? ""}
          onChange={(e) => {
            const next = e.target.value ? Number(e.target.value) : null;
            setTagId(next);
            setStatus("saving");
            startTransition(async () => {
              await updatePlaybook(id, { tagId: next });
              setStatus("saved");
            });
          }}
          className="h-7 rounded-md border border-input bg-card px-2 text-[12px] text-foreground outline-none focus:border-primary"
        >
          <option value="">None</option>
          {setupTags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span className="text-faint">Linked entries show live stats for trades with that tag.</span>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          queue({ content: e.target.value });
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            flush();
          }
        }}
        placeholder={"When does this setup appear?\n\nEntry\n- …\n\nStop:\nTarget:\nSkip if:"}
        className="min-h-[420px] resize-y rounded-[10px] border border-border bg-card px-4 py-3.5 font-mono text-[13px] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-faint focus:border-input"
      />

      <div className="flex justify-end">
        {confirmDelete ? (
          <span className="flex items-center gap-3 text-[12px]">
            <span className="text-muted-foreground">Delete this entry?</span>
            <button type="button" className="text-loss hover:underline" onClick={() => startTransition(() => deletePlaybook(id))}>
              Delete
            </button>
            <button type="button" className="text-faint hover:text-foreground" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-faint transition-colors hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete entry
          </button>
        )}
      </div>
    </div>
  );
}
