"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { AlertCircle, ArrowLeft, Check, Plus } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload-2";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import {
  fields,
  guessMapping,
  mappingProblems,
  parseRows,
  type AssetClass,
  type FieldId,
  type Mapping,
} from "@/lib/import/parse";
import { createAccount, importExecutions, type ImportResult } from "@/lib/import/actions";

type Account = { id: number; name: string; broker: string | null };
type Step = "upload" | "map" | "preview" | "done";

const MAX_FILE_MB = 20;

export function ImportWizard({ accounts }: { accounts: Account[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null);
  const [broker, setBroker] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("stock");
  const [multiplier, setMultiplier] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () =>
      step === "preview" || step === "done"
        ? parseRows(rows, mapping, { assetClass, multiplier: Number(multiplier) || 1 })
        : null,
    [step, rows, mapping, assetClass, multiplier],
  );

  function onFile(files: File[]) {
    const f = files[0];
    setError(null);
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return setError("Choose a .csv file. Excel files can be saved as CSV first.");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`Files are limited to ${MAX_FILE_MB} MB.`);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean);
        if (!hs.length || !res.data.length) return setError("That file has no rows we can read.");
        setFile(f);
        setHeaders(hs);
        setRows(res.data);
        setMapping(guessMapping(hs, res.data[0]));
        if (!broker) setBroker(f.name.replace(/\.[^.]+$/, "").split(/[_\-\s]/)[0] ?? "");
        setStep("map");
      },
      error: () => setError("We couldn't read that file. Check that it's a valid CSV."),
    });
  }

  function reset() {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setError(null);
    setStep("upload");
  }

  function submit() {
    if (!parsed || !accountId || !file) return;
    setError(null);
    startTransition(async () => {
      const res = await importExecutions({
        accountId,
        broker,
        fileName: file.name,
        executions: parsed.executions,
      });
      if (!res.ok) return setError(res.error);
      setResult(res);
      setStep("done");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Steps step={step} />

      {error && (
        <div className="flex items-start gap-2 rounded-[10px] border border-loss/30 bg-loss/5 px-4 py-3 text-[13px] text-loss">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4">
            <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} />
            <Field label="Broker" hint="A label for this import">
              <input className={inputCls} value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Interactive Brokers" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default asset class">
                <select className={inputCls} value={assetClass} onChange={(e) => {
                  const v = e.target.value as AssetClass;
                  setAssetClass(v);
                  setMultiplier(v === "option" ? "100" : "1");
                }}>
                  <option value="stock">Stock</option>
                  <option value="future">Future</option>
                  <option value="forex">Forex</option>
                  <option value="option">Option</option>
                </select>
              </Field>
              <Field label="Multiplier">
                <input className={cn(inputCls, "num")} inputMode="decimal" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
              </Field>
            </div>
            <p className="text-[12px] leading-relaxed text-faint">
              Defaults apply when the file has no asset class or multiplier column. Futures use the
              point value, for example 20 for NQ or 50 for ES.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FileUpload
              accept=".csv,.txt,text/csv"
              hint={`CSV up to ${MAX_FILE_MB} MB · one row per fill`}
              onFilesAdded={onFile}
              className="min-h-[260px]"
            />
            <p className="text-[12px] text-faint">
              No export handy?{" "}
              <a href="/template.csv" download className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Download the CSV template
              </a>
              . Files are read in your browser; only parsed fills are saved locally.
            </p>
          </div>
        </div>
      )}

      {step === "map" && (
        <div className="flex flex-col gap-4">
          <FileUpload file={file} onFileRemove={reset} />
          <div className="rounded-[10px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-sans text-[13px] font-medium tracking-normal">Match your columns</h2>
              <span className="num text-[12px] text-faint">{rows.length.toLocaleString()} rows · {headers.length} columns</span>
            </div>
            <div className="divide-y divide-border">
              {fields.map((f) => (
                <MapRow
                  key={f.id}
                  label={f.label}
                  required={f.required}
                  headers={headers}
                  value={mapping[f.id]}
                  sample={mapping[f.id] ? rows[0]?.[mapping[f.id]!] : undefined}
                  onChange={(col) =>
                    setMapping((m) => {
                      const next = { ...m };
                      if (col) next[f.id as FieldId] = col;
                      else delete next[f.id as FieldId];
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>
          <MappingFooter
            problems={mappingProblems(mapping)}
            onBack={reset}
            onNext={() => setStep("preview")}
          />
        </div>
      )}

      {step === "preview" && parsed && (
        <Preview
          parsed={parsed}
          pending={pending}
          canSubmit={!!accountId && parsed.executions.length > 0}
          onBack={() => setStep("map")}
          onSubmit={submit}
        />
      )}

      {step === "done" && result && (
        <div className="flex flex-col items-start gap-4 rounded-[10px] border border-border bg-card p-6">
          <span className="grid size-9 place-items-center rounded-full bg-profit/10 text-profit">
            <Check className="size-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[17px]">
              {result.inserted ? `Imported ${plural(result.inserted, "fill")}` : "Nothing new to import"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {result.inserted
                ? `Grouped into ${plural(result.trades, "trade")}.`
                : "Every fill in this file is already in your journal."}
              {result.skipped > 0 && ` Skipped ${plural(result.skipped, "duplicate")}.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className={primaryBtn}>View dashboard</Link>
            <button type="button" onClick={reset} className={secondaryBtn}>Import another file</button>
          </div>
        </div>
      )}
    </div>
  );
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

const inputCls =
  "h-8 w-full rounded-md border border-input bg-muted px-2.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary";
const primaryBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const secondaryBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-[13px] text-foreground transition-colors hover:bg-muted";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[12px] text-muted-foreground">
        {label}
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function AccountPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const [adding, setAdding] = useState(accounts.length === 0);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (adding) {
    return (
      <Field label="New account">
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="Futures – Tradovate"
          />
          <button
            type="button"
            disabled={pending}
            className={primaryBtn}
            onClick={() =>
              startTransition(async () => {
                const res = await createAccount(name, "");
                if (!res.ok) return setErr(res.error);
                onChange(res.id);
                setAdding(false);
                setName("");
              })
            }
          >
            Add
          </button>
        </div>
        {err && <span className="text-[12px] text-loss">{err}</span>}
        {accounts.length > 0 && (
          <button type="button" onClick={() => setAdding(false)} className="self-start text-[12px] text-faint hover:text-foreground">
            Cancel
          </button>
        )}
      </Field>
    );
  }

  return (
    <Field label="Account">
      <div className="flex gap-2">
        <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => setAdding(true)} className={cn(secondaryBtn, "px-2")} aria-label="Add account">
          <Plus className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </Field>
  );
}

function MapRow({
  label,
  required,
  headers,
  value,
  sample,
  onChange,
}: {
  label: string;
  required: boolean;
  headers: string[];
  value?: string;
  sample?: string;
  onChange: (col: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,16rem)_minmax(0,1fr)] items-center gap-4 px-4 py-2">
      <span className="text-[13px] text-foreground">
        {label}
        {required && <span className="ml-1 text-faint">*</span>}
      </span>
      <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Not in file</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="num truncate text-[12px] text-faint">{sample ?? ""}</span>
    </div>
  );
}

function MappingFooter({
  problems,
  onBack,
  onNext,
}: {
  problems: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onBack} className={secondaryBtn}>
        <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Choose another file
      </button>
      <div className="flex items-center gap-3">
        {problems[0] && <span className="text-[12px] text-faint">{problems[0]}</span>}
        <button type="button" onClick={onNext} disabled={problems.length > 0} className={primaryBtn}>
          Preview fills
        </button>
      </div>
    </div>
  );
}

function Preview({
  parsed,
  pending,
  canSubmit,
  onBack,
  onSubmit,
}: {
  parsed: ReturnType<typeof parseRows>;
  pending: boolean;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { executions, errors } = parsed;
  const symbols = new Set(executions.map((e) => e.symbol)).size;
  const first = executions.reduce((m, e) => Math.min(m, e.executedAt), Infinity);
  const last = executions.reduce((m, e) => Math.max(m, e.executedAt), 0);
  const fees = executions.reduce((s, e) => s + e.fees, 0);
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Fills" value={executions.length.toLocaleString()} />
        <MiniStat label="Symbols" value={String(symbols)} />
        <MiniStat label="Date range" value={executions.length ? `${fmtDate(first)} – ${fmtDate(last)}` : "—"} small />
        <MiniStat label="Fees" value={formatMoney(fees)} />
      </div>

      {errors.length > 0 && (
        <div className="rounded-[10px] border border-border bg-card px-4 py-3">
          <p className="text-[13px] text-foreground">
            {errors.length === 1
              ? "1 row can't be imported and will be skipped"
              : `${errors.length.toLocaleString()} rows can't be imported and will be skipped`}
          </p>
          <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-faint">
            {errors.slice(0, 6).map((e) => (
              <li key={e.row} className="num">Row {e.row}: {e.message}</li>
            ))}
            {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-card text-[12px] text-faint">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-normal">Time</th>
                <th className="px-4 py-2 text-left font-normal">Symbol</th>
                <th className="px-4 py-2 text-left font-normal">Side</th>
                <th className="px-4 py-2 text-right font-normal">Qty</th>
                <th className="px-4 py-2 text-right font-normal">Price</th>
                <th className="px-4 py-2 text-right font-normal">Fees</th>
              </tr>
            </thead>
            <tbody>
              {executions.slice(0, 200).map((e, i) => (
                <tr key={i} className="h-9 border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="num px-4 text-muted-foreground">
                    {new Date(e.executedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </td>
                  <td className="px-4 font-medium">{e.symbol}</td>
                  <td className={cn("px-4", e.action === "buy" ? "text-foreground" : "text-muted-foreground")}>
                    {e.action === "buy" ? "Buy" : "Sell"}
                  </td>
                  <td className="num px-4 text-right">{e.quantity.toLocaleString()}</td>
                  <td className="num px-4 text-right">{e.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                  <td className="num px-4 text-right text-muted-foreground">{e.fees.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {executions.length > 200 && (
          <p className="border-t border-border px-4 py-2 text-[12px] text-faint">
            Showing the first 200 of {executions.length.toLocaleString()} fills
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className={secondaryBtn}>
          <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Back to columns
        </button>
        <button type="button" onClick={onSubmit} disabled={!canSubmit || pending} className={primaryBtn}>
          {pending ? "Importing…" : `Import ${executions.length.toLocaleString()} fills`}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-card px-4 py-3">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("num truncate", small ? "text-[13px] leading-[26px]" : "text-[20px]")}>{value}</span>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const items: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Columns" },
    { id: "preview", label: "Preview" },
    { id: "done", label: "Done" },
  ];
  const current = items.findIndex((i) => i.id === step);
  return (
    <ol className="flex items-center gap-2 text-[12px]">
      {items.map((item, i) => (
        <li key={item.id} className="flex items-center gap-2">
          <span
            className={cn(
              "num grid size-5 place-items-center rounded-full border text-[11px]",
              i < current && "border-primary bg-primary text-primary-foreground",
              i === current && "border-primary text-foreground",
              i > current && "border-input text-faint",
            )}
          >
            {i < current ? <Check className="size-3" strokeWidth={2.5} /> : i + 1}
          </span>
          <span className={i <= current ? "text-foreground" : "text-faint"}>{item.label}</span>
          {i < items.length - 1 && <span className="mx-1 h-px w-6 bg-input" />}
        </li>
      ))}
    </ol>
  );
}
