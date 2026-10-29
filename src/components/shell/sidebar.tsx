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
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <div className="flex items-center gap-2 px-2 pb-6">
        <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
          <ChartNoAxesColumn className="size-3.5" strokeWidth={2} />
        </span>
        <span className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          Ledger
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
        {secondary.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>
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
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-150",
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute -left-3 top-1.5 h-5 w-0.5 rounded-r bg-primary" />
      )}
      <Icon className="size-4" strokeWidth={1.5} />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="num rounded bg-muted px-1.5 text-[11px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
          {shortcut}
        </kbd>
      )}
    </Link>
  );
}
