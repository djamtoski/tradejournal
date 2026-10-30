"use client";

import { useState, useTransition } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncInboxNow } from "@/lib/import/actions";
import type { InboxFileResult } from "@/lib/import/inbox";

/** "Sync inbox now" plus the per-file outcome of the last run. */
export function InboxSync({ lastResults }: { lastResults?: InboxFileResult[] }) {
  const [results, setResults] = useState<InboxFileResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = results ?? lastResults ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await syncInboxNow();
              if (!res.ok) return setError(res.error);
              setError(null);
              setResults(res.run.results);
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", pending && "animate-spin")} strokeWidth={1.5} />
          {pending ? "Syncing…" : "Sync inbox now"}
        </button>
        {error && <span className="text-[12px] text-loss">{error}</span>}
        {results && !results.length && !error && <span className="text-[12px] text-faint">No new files in the inbox.</span>}
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1 text-[12px]">
          {shown.map((r, i) => (
            <li key={`${r.file}-${i}`} className="flex items-start gap-1.5">
              {r.ok ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-profit" strokeWidth={2} />
              ) : (
                <X className="mt-0.5 size-3.5 shrink-0 text-loss" strokeWidth={2} />
              )}
              <span className="min-w-0">
                <span className="text-foreground">{r.file}</span> <span className="text-faint">· {r.message}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
