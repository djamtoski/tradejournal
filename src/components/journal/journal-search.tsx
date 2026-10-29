"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function JournalSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  useEffect(() => {
    if (q === initial) return;
    const t = setTimeout(() => {
      router.replace(q ? `/journal?q=${encodeURIComponent(q)}` : "/journal", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [q, initial, router]);

  return (
    <label className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" strokeWidth={1.5} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your journal"
        aria-label="Search journal entries"
        className="h-8 w-72 rounded-md border border-input bg-card pl-8 pr-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary"
      />
    </label>
  );
}
