"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTrade } from "@/lib/trades/actions";

/** Delete a hand-entered trade, with one confirmation step. */
export function DeleteTradeButton({ id, closeHref }: { id: number; closeHref: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-faint transition-colors hover:bg-muted hover:text-foreground"
      >
        <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete trade
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-3 text-[12px]">
      <span className="text-muted-foreground">Delete this trade and its tags and screenshots?</span>
      <button
        type="button"
        disabled={pending}
        className="text-loss hover:underline"
        onClick={() =>
          start(async () => {
            const res = await deleteTrade(id);
            if (!res.ok) return setError(res.error);
            router.push(closeHref, { scroll: false });
            router.refresh();
          })
        }
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" className="text-faint hover:text-foreground" onClick={() => setAsking(false)}>
        Cancel
      </button>
      {error && <span className="w-full text-loss">{error}</span>}
    </span>
  );
}
