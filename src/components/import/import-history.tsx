"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteImport } from "@/lib/import/actions";
import { formatDateTime } from "@/lib/tz";

type Row = {
  id: number;
  fileName: string;
  broker: string;
  executionCount: number;
  createdAt: Date;
  accountName: string;
};

export function ImportHistory({ imports, timezone }: { imports: Row[]; timezone: string }) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (!imports.length) {
    return <p className="px-4 pb-4 pt-1 text-[13px] text-faint">Your imports will show up here.</p>;
  }

  return (
    <table className="w-full text-[13px]">
      <thead className="text-[12px] text-faint">
        <tr className="border-b border-border">
          <th className="px-4 py-2 text-left font-normal">Imported</th>
          <th className="px-4 py-2 text-left font-normal">File</th>
          <th className="px-4 py-2 text-left font-normal">Account</th>
          <th className="px-4 py-2 text-right font-normal">Fills</th>
          <th className="w-28 px-4 py-2" />
        </tr>
      </thead>
      <tbody>
        {imports.map((imp) => (
          <tr key={imp.id} className="group h-10 border-b border-border last:border-0 hover:bg-muted/50">
            <td className="num px-4 text-muted-foreground">
              {formatDateTime(imp.createdAt, timezone)}
            </td>
            <td className="max-w-[18rem] truncate px-4">
              {imp.fileName} <span className="text-faint">· {imp.broker}</span>
            </td>
            <td className="px-4 text-muted-foreground">{imp.accountName}</td>
            <td className="num px-4 text-right">{imp.executionCount.toLocaleString()}</td>
            <td className="px-4 text-right">
              {confirming === imp.id ? (
                <span className="flex items-center justify-end gap-2 text-[12px]">
                  <button
                    type="button"
                    disabled={pending}
                    className="text-loss hover:underline"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteImport(imp.id);
                        setConfirming(null);
                      })
                    }
                  >
                    {pending ? "Deleting…" : "Delete"}
                  </button>
                  <button type="button" className="text-faint hover:text-foreground" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(imp.id)}
                  className="inline-grid size-7 place-items-center rounded-md text-faint opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Undo import of ${imp.fileName}`}
                >
                  <Trash2 className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
