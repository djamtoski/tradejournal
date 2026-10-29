import { cn } from "@/lib/utils";

export function Panel({
  title,
  meta,
  className,
  children,
}: {
  title?: string;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[10px] border border-border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <h2 className="font-sans text-[13px] font-medium tracking-normal text-muted-foreground">
            {title}
          </h2>
          {meta && <div className="text-[12px] text-faint">{meta}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-card px-4 py-3.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("num truncate text-[24px] leading-none tracking-tight", tone)}>{value}</span>
      {sub && <span className="num truncate text-[12px] text-faint">{sub}</span>}
    </div>
  );
}
