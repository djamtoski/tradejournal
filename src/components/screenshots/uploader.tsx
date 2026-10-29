"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload-2";

type TradeOption = { id: number; day: string; label: string };

const inputCls =
  "h-8 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary";

/** Drop, pick or paste (Ctrl+V) an image, link it to a day or trade, and upload. */
export function ScreenshotUploader({
  trades,
  defaultDay,
  defaultTradeId,
}: {
  trades: TradeOption[];
  defaultDay: string;
  defaultTradeId?: number | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [day, setDay] = useState(defaultDay);
  const [tradeId, setTradeId] = useState<number | null>(defaultTradeId ?? null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Release the last preview URL when the uploader goes away.
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const showPreview = (f: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = f ? URL.createObjectURL(f) : null;
    setPreview(previewRef.current);
  };

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Choose a PNG, JPEG, WebP or GIF image.");
    if (f.size > 10 * 1024 * 1024) return setError("Images are limited to 10 MB.");
    setFile(f);
    showPreview(f);
  };

  // Paste a screenshot straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        choose(new File([f], `pasted-${Date.now()}.png`, { type: f.type }));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // `choose` only touches state setters and a ref, so the first render's copy stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayTrades = trades.filter((t) => t.day === day);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("day", day);
    if (tradeId) body.set("tradeId", String(tradeId));
    body.set("caption", caption);
    try {
      const res = await fetch("/api/screenshots", { method: "POST", body });
      const json = (await res.json()) as { ok: boolean; id?: number; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Upload failed.");
      router.push(`/screenshots?id=${json.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
      {preview ? (
        <div className="relative overflow-hidden rounded-[10px] border border-border bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={preview} alt="Selected screenshot" className="max-h-[320px] w-full object-contain" />
          <button
            type="button"
            onClick={() => {
              setFile(null);
              showPreview(null);
            }}
            className="absolute right-2 top-2 rounded-md bg-popover/90 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            Choose another
          </button>
        </div>
      ) : (
        <FileUpload
          accept="image/png,image/jpeg,image/webp,image/gif"
          title="Drop a chart screenshot here"
          hint="PNG, JPEG, WebP or GIF up to 10 MB · or paste with Ctrl+V"
          onFilesAdded={(files) => choose(files[0])}
          className="min-h-[180px]"
        />
      )}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted-foreground">Day</span>
          <input
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setTradeId(null);
            }}
            className={`${inputCls} num [color-scheme:dark]`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted-foreground">Trade</span>
          <select
            value={tradeId ?? ""}
            onChange={(e) => setTradeId(e.target.value ? Number(e.target.value) : null)}
            className={inputCls}
            disabled={!dayTrades.length}
          >
            <option value="">{dayTrades.length ? "Whole day" : "No trades that day"}</option>
            {dayTrades.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted-foreground">Caption</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Failed breakdown at VWAP" className={inputCls} />
        </label>
        {error && (
          <p className="flex items-start gap-1.5 text-[12px] text-loss">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} /> {error}
          </p>
        )}
        <button
          type="button"
          onClick={upload}
          disabled={!file || busy}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Upload and annotate"}
        </button>
      </div>
    </div>
  );
}
