"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { tradesHref, type TradeFilters } from "@/lib/trades/filters";
import { cn } from "@/lib/utils";

const selectCls =
  "h-7 rounded-md border border-input bg-card px-2 text-[12px] text-foreground outline-none transition-colors focus:border-primary";

export function FilterRow({
  filters,
  tags,
}: {
  filters: TradeFilters;
  tags: { name: string; group: string | null }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const go = (patch: Partial<TradeFilters>) =>
    router.push(tradesHref(filters, { ...patch, page: 1, trade: null }), { scroll: false });

  // Debounced symbol search.
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => go({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = filters.q || filters.side || filters.result || filters.tag || filters.rules;
  const groups = Map.groupBy(tags, (t) => t.group ?? "Other");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" strokeWidth={1.5} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Symbol"
          aria-label="Filter by symbol"
          className={cn(selectCls, "w-32 pl-7 uppercase placeholder:normal-case placeholder:text-faint")}
        />
      </label>
      <select aria-label="Side" className={selectCls} value={filters.side} onChange={(e) => go({ side: e.target.value as TradeFilters["side"] })}>
        <option value="">Long and short</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>
      <select aria-label="Result" className={selectCls} value={filters.result} onChange={(e) => go({ result: e.target.value as TradeFilters["result"] })}>
        <option value="">Wins and losses</option>
        <option value="win">Wins</option>
        <option value="loss">Losses</option>
      </select>
      <select aria-label="Tag" className={selectCls} value={filters.tag} onChange={(e) => go({ tag: e.target.value })}>
        <option value="">All tags</option>
        {[...groups.entries()].map(([group, list]) => (
          <optgroup key={group} label={group}>
            {list.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <select aria-label="Rules" className={selectCls} value={filters.rules} onChange={(e) => go({ rules: e.target.value as TradeFilters["rules"] })}>
        <option value="">Any rule rating</option>
        <option value="yes">Followed rules</option>
        <option value="no">Broke rules</option>
        <option value="unset">Not rated</option>
      </select>
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            go({ q: "", side: "", result: "", tag: "", rules: "" });
          }}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-faint transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={1.5} /> Clear
        </button>
      )}
    </div>
  );
}
