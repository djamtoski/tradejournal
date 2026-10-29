"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  assetClassOptions,
  FILTER_COOKIE,
  groupings,
  ranges,
  serializeFilters,
  type AssetClassId,
  type Filters,
} from "@/lib/filters";

/**
 * Filters shared by every page. Changes are saved to a cookie and the page
 * re-renders on the server with the new slice of trades.
 */
export function FilterBar({
  filters,
  accounts,
  showRange = true,
  showGrouping = false,
}: {
  filters: Filters;
  accounts: { id: number; name: string }[];
  showRange?: boolean;
  showGrouping?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    document.cookie = `${FILTER_COOKIE}=${encodeURIComponent(serializeFilters(next))}; path=/; max-age=31536000; samesite=lax`;
    start(() => {
      // A range/mode in the URL would override the cookie, so drop it once the user chooses.
      if (("range" in patch || "mode" in patch) && (params.has("range") || params.has("mode"))) {
        const rest = new URLSearchParams(params);
        rest.delete("range");
        rest.delete("mode");
        const qs = rest.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      {accounts.length > 1 && (
        <MultiSelect
          label="Accounts"
          allLabel="All accounts"
          options={accounts.map((a) => ({ id: a.id, label: a.name }))}
          selected={filters.accountIds}
          onChange={(accountIds) => update({ accountIds })}
        />
      )}
      <MultiSelect
        label="Assets"
        allLabel="All assets"
        options={assetClassOptions.map((o) => ({ id: o.id, label: o.label }))}
        selected={filters.assetClasses}
        onChange={(assetClasses) => update({ assetClasses: assetClasses as AssetClassId[] })}
      />
      {showRange && (
        <Segmented>
          {ranges.map((r) => (
            <SegmentButton key={r.id} active={filters.range === r.id} onClick={() => update({ range: r.id })}>
              {r.label}
            </SegmentButton>
          ))}
        </Segmented>
      )}
      {showGrouping && (
        <Segmented>
          {groupings.map((g) => (
            <SegmentButton key={g.id} active={filters.grouping === g.id} onClick={() => update({ grouping: g.id })}>
              {g.label}
            </SegmentButton>
          ))}
        </Segmented>
      )}
      <Segmented>
        <SegmentButton active={filters.mode === "net"} onClick={() => update({ mode: "net" })}>
          Net
        </SegmentButton>
        <SegmentButton active={filters.mode === "gross"} onClick={() => update({ mode: "gross" })}>
          Gross
        </SegmentButton>
      </Segmented>
    </div>
  );
}

function Segmented({ children }: { children: React.ReactNode }) {
  return <div className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-card p-0.5">{children}</div>;
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "num flex h-full items-center rounded-[5px] px-2.5 text-[12px] transition-colors duration-150",
        active ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_var(--input)]" : "text-faint hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Dropdown of checkboxes. An empty selection means "all". */
function MultiSelect<T extends string | number>({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: { id: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const active = selected.filter((s) => options.some((o) => o.id === s));
  const text =
    active.length === 0
      ? allLabel
      : active.length === 1
        ? options.find((o) => o.id === active[0])!.label
        : `${active.length} ${label.toLowerCase()}`;

  const toggle = (id: T) =>
    onChange(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${text}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] transition-colors hover:text-foreground",
          active.length ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {active.length > 0 && <span className="size-1.5 rounded-full bg-primary" />}
        {text}
        <ChevronDown className="size-3.5 text-faint" strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute right-0 z-30 mt-1 min-w-48 rounded-md border border-input bg-popover p-1 shadow-[0_8px_24px_rgb(0_0_0/0.4)]"
        >
          <Option checked={active.length === 0} onClick={() => onChange([])}>
            {allLabel}
          </Option>
          <div className="my-1 h-px bg-border" />
          {options.map((o) => (
            <Option key={o.id} checked={active.includes(o.id)} onClick={() => toggle(o.id)}>
              {o.label}
            </Option>
          ))}
        </div>
      )}
    </div>
  );
}

function Option({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted"
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-[4px] border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={2.5} />}
      </span>
      {children}
    </button>
  );
}
