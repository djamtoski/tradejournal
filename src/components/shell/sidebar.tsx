"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  Images,
  LayoutDashboard,
  ListOrdered,
  NotebookPen,
  Settings,
  Sun,
  NotebookText,
  Target,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "D" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "C" },
  { href: "/daily", label: "Daily", icon: Sun, shortcut: "Y" },
  { href: "/trades", label: "Trades", icon: ListOrdered, shortcut: "T" },
  { href: "/journal", label: "Journal", icon: NotebookPen, shortcut: "J" },
  { href: "/playbook", label: "Playbook", icon: BookOpen, shortcut: "P" },
  { href: "/goals", label: "Goals", icon: Target, shortcut: "G" },
  { href: "/reviews", label: "Reviews", icon: NotebookText, shortcut: "R" },
  { href: "/screenshots", label: "Screenshots", icon: Images, shortcut: "S" },
];

const secondary = [
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    // Below md the sidebar becomes an icon rail so the page keeps its width on small screens.
    <aside className="flex w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-2 py-4 md:w-[232px] md:px-3">
      <div className="flex items-center justify-center gap-2 pb-6 md:justify-start md:px-2">
        <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
          <ChartNoAxesColumn className="size-3.5" strokeWidth={2} />
        </span>
        <span className="hidden font-heading text-[15px] font-semibold tracking-tight text-foreground md:inline">
          Ledger
        </span>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <nav aria-label="App" className="mt-auto flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
        {secondary.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  shortcut,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  shortcut?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "group relative flex h-9 items-center justify-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-150 md:h-8 md:justify-start",
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute -left-2 top-2 h-5 w-0.5 rounded-r bg-primary md:-left-3 md:top-1.5" />
      )}
      <Icon className="size-4" strokeWidth={1.5} />
      <span className="sr-only flex-1 md:not-sr-only">{label}</span>
      {shortcut && (
        <kbd className="num hidden rounded bg-muted px-1.5 text-[11px] text-faint opacity-0 transition-opacity group-hover:opacity-100 md:inline">
          {shortcut}
        </kbd>
      )}
    </Link>
  );
}
