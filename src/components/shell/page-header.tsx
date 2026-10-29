import Link from "next/link";
import { cn } from "@/lib/utils";
import { filterHref, ranges, type Filters } from "@/lib/filters";

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
      <h1 className="text-[15px]">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

/** Range + gross/net controls. Links, so filters live in the URL. */
export function FilterBar({ filters, path = "/" }: { filters: Filters; path?: string }) {
  return (
    <>
      <Segmented>
        {ranges.map((r) => (
          <Segment
            key={r.id}
            href={filterHref(filters, { range: r.id }, path)}
            active={filters.range === r.id}
          >
            {r.label}
          </Segment>
        ))}
      </Segmented>
      <Segmented>
        <Segment href={filterHref(filters, { mode: "net" }, path)} active={filters.mode === "net"}>
          Net
        </Segment>
        <Segment
          href={filterHref(filters, { mode: "gross" }, path)}
          active={filters.mode === "gross"}
        >
          Gross
        </Segment>
      </Segmented>
    </>
  );
}

export function Segmented({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
      {children}
    </div>
  );
}

export function Segment({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "num flex h-full items-center rounded-[5px] px-2.5 text-[12px] transition-colors duration-150",
        active
          ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_var(--input)]"
          : "text-faint hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
