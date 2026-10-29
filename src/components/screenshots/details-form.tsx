"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteScreenshot, updateScreenshot } from "@/lib/screenshots/actions";

/** Caption editing and delete for one screenshot. */
export function ScreenshotDetailsForm({ id, caption: initial }: { id: number; caption: string }) {
  const router = useRouter();
  const [caption, setCaption] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted-foreground">Caption</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== saved) {
              setSaved(v);
              start(async () => void (await updateScreenshot(id, { caption: v })));
            }
          }}
          rows={3}
          placeholder="What does this chart show?"
          className="resize-y rounded-md border border-input bg-background px-2.5 py-2 text-[13px] outline-none transition-colors placeholder:text-faint focus:border-primary"
        />
      </label>
      {confirm ? (
        <span className="flex items-center gap-3 text-[12px]">
          <span className="text-muted-foreground">Delete this screenshot?</span>
          <button
            type="button"
            className="text-loss hover:underline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await deleteScreenshot(id);
                router.push("/screenshots");
                router.refresh();
              })
            }
          >
            Delete
          </button>
          <button type="button" className="text-faint hover:text-foreground" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-faint transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete screenshot
        </button>
      )}
    </div>
  );
}
