"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveJournalEntry } from "@/lib/journal/actions";

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

/** Daily notes with autosave (debounced) and a followed-my-rules rating. */
export function JournalEditor({
  day,
  initialContent,
  initialFollowedRules,
}: {
  day: string;
  initialContent: string;
  initialFollowedRules: boolean | null;
}) {
  const [content, setContent] = useState(initialContent);
  const [followedRules, setFollowedRules] = useState(initialFollowedRules);
  const [status, setStatus] = useState<Status>("idle");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest values for the debounced save and unmount flush.
  const latest = useRef({ content: initialContent, followedRules: initialFollowedRules });

  const update = (patch: Partial<typeof latest.current>) => {
    latest.current = { ...latest.current, ...patch };
    if (patch.content !== undefined) setContent(patch.content);
    if (patch.followedRules !== undefined) setFollowedRules(patch.followedRules);
    schedule();
  };

  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    startTransition(async () => {
      const res = await saveJournalEntry({ day, ...latest.current });
      setStatus(res.ok ? "saved" : "error");
    });
  };

  const schedule = () => {
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  };

  // Flush pending edits when leaving the day.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void saveJournalEntry({ day, ...latest.current });
      }
    },
    [day],
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">Followed my rules</span>
        <div className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          <RuleButton
            active={followedRules === true}
            onClick={() => update({ followedRules: followedRules === true ? null : true })}
            tone="profit"
          >
            <Check className="size-3.5" strokeWidth={2} /> Yes
          </RuleButton>
          <RuleButton
            active={followedRules === false}
            onClick={() => update({ followedRules: followedRules === false ? null : false })}
            tone="loss"
          >
            <X className="size-3.5" strokeWidth={2} /> No
          </RuleButton>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => update({ content: e.target.value })}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            save();
          }
        }}
        placeholder="How did you trade today? What went well, what will you change tomorrow?"
        className="min-h-[220px] resize-y rounded-md border border-input bg-background px-3 py-2.5 text-[14px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary"
      />
      <span className="h-4 text-right text-[12px] text-faint" aria-live="polite">
        {status === "dirty" && "Unsaved changes"}
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "error" && <span className="text-loss">Couldn&apos;t save. Try again.</span>}
      </span>
    </div>
  );
}

function RuleButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "profit" | "loss";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-full items-center gap-1 rounded-[5px] px-2 text-[12px] transition-colors duration-150",
        active
          ? tone === "profit"
            ? "bg-profit/15 text-profit"
            : "bg-loss/15 text-loss"
          : "text-faint hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
