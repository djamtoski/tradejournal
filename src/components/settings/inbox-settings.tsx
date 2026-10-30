"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setInbox } from "@/lib/settings/actions";
import { InboxSync } from "@/components/import/inbox-sync";
import type { InboxFileResult } from "@/lib/import/inbox";
import { inputCls } from "./controls";

type Props = {
  folder: string | null;
  accountId: number | null;
  accounts: { id: number; name: string }[];
  status: { watching: boolean; error: string | null; lastResults?: InboxFileResult[] };
};

export function InboxSettings({ folder, accountId, accounts, status }: Props) {
  const [dir, setDir] = useState(folder ?? "");
  const [account, setAccount] = useState(String(accountId ?? accounts[0]?.id ?? ""));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (nextDir: string) =>
    start(async () => {
      const res = await setInbox(nextDir, account ? Number(account) : null);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setMessage({ ok: true, text: nextDir.trim() ? "Saved. Watching this folder." : "Inbox turned off." });
      if (!nextDir.trim()) setDir("");
    });

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          placeholder="Full folder path"
          aria-label="Inbox folder"
          spellCheck={false}
          className={cn(inputCls, "num h-8 min-w-0 flex-1 basis-72")}
        />
        <select aria-label="Inbox account" value={account} onChange={(e) => setAccount(e.target.value)} className={cn(inputCls, "h-8")}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !dir.trim() || !account}
          onClick={() => save(dir)}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save
        </button>
        {folder && (
          <button type="button" disabled={pending} onClick={() => save("")} className="h-8 px-2 text-[12px] text-faint hover:text-foreground">
            Turn off
          </button>
        )}
      </div>
      {message ? (
        <span className={cn("text-[12px]", message.ok ? "text-profit" : "text-loss")}>{message.text}</span>
      ) : (
        folder && (
          <span className={cn("text-[12px]", status.watching ? "text-faint" : "text-loss")}>
            {status.watching ? "Watching while Ledger is running." : `Not watching: ${status.error ?? "restart the app to start the watcher"}.`}
          </span>
        )
      )}
      {folder && <InboxSync lastResults={status.lastResults} />}
    </div>
  );
}
