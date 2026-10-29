"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveFuture, type AssetClass } from "@/lib/instruments";
import type { FieldErrors, ManualTradeInput } from "@/lib/trades/manual";
import { createTrade, updateTradeCore } from "@/lib/trades/actions";

type Account = { id: number; name: string };

type Draft = {
  accountId: string;
  symbol: string;
  assetClass: AssetClass;
  side: "long" | "short";
  quantity: string;
  multiplier: string;
  entryPrice: string;
  exitPrice: string;
  openedAt: string;
  closedAt: string;
  fees: string;
};

const inputCls =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary aria-[invalid=true]:border-loss";

const toDraft = (v: ManualTradeInput): Draft => ({
  accountId: String(v.accountId),
  symbol: v.symbol,
  assetClass: v.assetClass,
  side: v.side,
  quantity: String(v.quantity),
  multiplier: String(v.multiplier),
  entryPrice: String(v.entryPrice),
  exitPrice: v.exitPrice === null ? "" : String(v.exitPrice),
  openedAt: v.openedAt,
  closedAt: v.closedAt ?? "",
  fees: String(v.fees),
});

const numOrNaN = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));

/** "New trade" button + dialog, or an "Edit" dialog when `trade` is given. */
export function TradeFormDialog({
  accounts,
  defaultOpenedAt,
  trade,
}: {
  accounts: Account[];
  defaultOpenedAt: string;
  trade?: { id: number; values: ManualTradeInput };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const blank: Draft = {
    accountId: String(accounts[0]?.id ?? ""),
    symbol: "",
    assetClass: "stock",
    side: "long",
    quantity: "",
    multiplier: "1",
    entryPrice: "",
    exitPrice: "",
    openedAt: defaultOpenedAt,
    closedAt: "",
    fees: "0",
  };
  const [draft, setDraft] = useState<Draft>(trade ? toDraft(trade.values) : blank);
  const [multiplierTouched, setMultiplierTouched] = useState(Boolean(trade));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const open = () => {
    if (!trade) setDraft({ ...blank, accountId: draft.accountId || blank.accountId });
    setErrors({});
    setFormError(null);
    ref.current?.showModal();
  };

  // Fill asset class and point value from known futures symbols, unless the user set them.
  const onSymbolBlur = () => {
    const fut = resolveFuture(draft.symbol);
    if (fut) {
      setDraft((d) => ({
        ...d,
        symbol: fut.root,
        assetClass: "future",
        multiplier: multiplierTouched ? d.multiplier : String(fut.multiplier),
      }));
    }
  };

  const submit = () => {
    const input: ManualTradeInput = {
      accountId: Number(draft.accountId),
      symbol: draft.symbol,
      assetClass: draft.assetClass,
      side: draft.side,
      quantity: numOrNaN(draft.quantity),
      multiplier: numOrNaN(draft.multiplier),
      entryPrice: numOrNaN(draft.entryPrice),
      exitPrice: draft.exitPrice.trim() === "" ? null : numOrNaN(draft.exitPrice),
      openedAt: draft.openedAt,
      closedAt: draft.closedAt.trim() === "" ? null : draft.closedAt,
      fees: draft.fees.trim() === "" ? 0 : numOrNaN(draft.fees),
    };
    start(async () => {
      const res = trade ? await updateTradeCore(trade.id, input) : await createTrade(input);
      if (!res.ok) {
        setErrors(res.errors);
        setFormError(res.error ?? null);
        return;
      }
      ref.current?.close();
      if (!trade) router.push(`/trades?range=all&trade=${res.id}`, { scroll: false });
      router.refresh();
    });
  };

  return (
    <>
      {trade ? (
        <button
          type="button"
          onClick={open}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-faint transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} /> Edit trade
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" strokeWidth={2} /> New trade
        </button>
      )}

      <dialog
        ref={ref}
        aria-labelledby="trade-form-title"
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[12px] border border-input bg-popover p-0 text-foreground shadow-[0_8px_24px_rgb(0_0_0/0.4)] backdrop:bg-black/60"
      >
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 id="trade-form-title" className="text-[15px]">{trade ? "Edit trade" : "New trade"}</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="grid size-7 place-items-center rounded-md text-faint hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-5 py-4 sm:grid-cols-4">
            <Field label="Account" error={errors.accountId} className="col-span-2">
              <select className={inputCls} value={draft.accountId} onChange={(e) => set("accountId", e.target.value)} aria-invalid={!!errors.accountId}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Symbol" error={errors.symbol} className="col-span-2">
              <input
                className={cn(inputCls, "uppercase placeholder:normal-case")}
                value={draft.symbol}
                onChange={(e) => set("symbol", e.target.value)}
                onBlur={onSymbolBlur}
                placeholder="NQ, NQZ6, AAPL"
                autoFocus
                aria-invalid={!!errors.symbol}
              />
            </Field>

            <Field label="Side" error={errors.side} className="col-span-2">
              <div className="flex h-8 items-center gap-0.5 rounded-md border border-input bg-background p-0.5">
                {(["long", "short"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={draft.side === s}
                    onClick={() => set("side", s)}
                    className={cn(
                      "h-full flex-1 rounded-[5px] text-[12px] transition-colors",
                      draft.side === s ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_var(--input)]" : "text-faint hover:text-foreground",
                    )}
                  >
                    {s === "long" ? "Long" : "Short"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Asset class" error={errors.assetClass}>
              <select
                className={inputCls}
                value={draft.assetClass}
                onChange={(e) => {
                  const v = e.target.value as AssetClass;
                  set("assetClass", v);
                  if (!multiplierTouched) set("multiplier", v === "option" ? "100" : v === "future" ? draft.multiplier : "1");
                }}
              >
                <option value="stock">Stock</option>
                <option value="future">Future</option>
                <option value="forex">Forex</option>
                <option value="option">Option</option>
              </select>
            </Field>
            <Field label="Multiplier" error={errors.multiplier}>
              <input
                className={cn(inputCls, "num")}
                inputMode="decimal"
                value={draft.multiplier}
                onChange={(e) => {
                  set("multiplier", e.target.value);
                  setMultiplierTouched(true);
                }}
                aria-invalid={!!errors.multiplier}
              />
            </Field>

            <Field label="Quantity" error={errors.quantity}>
              <input className={cn(inputCls, "num")} inputMode="decimal" value={draft.quantity} onChange={(e) => set("quantity", e.target.value)} aria-invalid={!!errors.quantity} />
            </Field>
            <Field label="Entry price" error={errors.entryPrice}>
              <input className={cn(inputCls, "num")} inputMode="decimal" value={draft.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} aria-invalid={!!errors.entryPrice} />
            </Field>
            <Field label="Exit price" hint="optional" error={errors.exitPrice}>
              <input className={cn(inputCls, "num")} inputMode="decimal" value={draft.exitPrice} onChange={(e) => set("exitPrice", e.target.value)} placeholder="Still open" aria-invalid={!!errors.exitPrice} />
            </Field>
            <Field label="Fees" error={errors.fees}>
              <input className={cn(inputCls, "num")} inputMode="decimal" value={draft.fees} onChange={(e) => set("fees", e.target.value)} aria-invalid={!!errors.fees} />
            </Field>

            <Field label="Opened" error={errors.openedAt} className="col-span-2">
              <input type="datetime-local" className={cn(inputCls, "num [color-scheme:dark]")} value={draft.openedAt} onChange={(e) => set("openedAt", e.target.value)} aria-invalid={!!errors.openedAt} />
            </Field>
            <Field label="Closed" hint="optional" error={errors.closedAt} className="col-span-2">
              <input type="datetime-local" className={cn(inputCls, "num [color-scheme:dark]")} value={draft.closedAt} onChange={(e) => set("closedAt", e.target.value)} aria-invalid={!!errors.closedAt} />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-[12px] text-faint">
              {formError ? <span className="text-loss">{formError}</span> : "Leave exit and close empty to record an open position. Times are in your trading timezone."}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="h-8 shrink-0 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : trade ? "Save changes" : "Add trade"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-baseline justify-between text-[12px] text-muted-foreground">
        {label}
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-[12px] text-loss">{error}</span>}
    </label>
  );
}
