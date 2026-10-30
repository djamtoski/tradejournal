import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-background/85 px-6 py-2 backdrop-blur">
      <h1 className="shrink-0 text-[15px]">{title}</h1>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </header>
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
