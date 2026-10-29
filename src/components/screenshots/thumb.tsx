import Link from "next/link";
import { cn } from "@/lib/utils";
import { parseDay } from "@/lib/dates";
import { formatPnl, pnlTone } from "@/lib/format";
import type { ScreenshotItem } from "@/lib/screenshots/queries";
import { AnnotationLayer } from "./annotation-layer";

/** Gallery card: image with its annotations, plus date, trade and caption. */
export function ScreenshotThumb({ item, compact }: { item: ScreenshotItem; compact?: boolean }) {
  const date = item.day ? parseDay(item.day) : null;
  return (
    <Link
      href={`/screenshots?id=${item.id}`}
      className="group flex flex-col overflow-hidden rounded-[10px] border border-border bg-card transition-colors hover:border-input"
    >
      <div className={cn("relative overflow-hidden bg-black/40", compact ? "aspect-[16/10]" : "aspect-[16/10]")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the local API */}
        <img src={item.src} alt={item.caption ?? "Chart screenshot"} loading="lazy" className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]" />
        {item.annotations && (
          <div className="absolute inset-x-0 top-0" style={{ aspectRatio: item.annotations.aspect }}>
            <AnnotationLayer annotations={item.annotations} />
          </div>
        )}
      </div>
      {!compact && (
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-muted-foreground">
              {date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}
            </span>
            {item.trade && (
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">{item.trade.symbol}</span>
                <span className={cn("num", pnlTone(item.trade.netPnl))}>{formatPnl(item.trade.netPnl)}</span>
              </span>
            )}
          </div>
          {item.caption && <p className="truncate text-[13px] text-foreground">{item.caption}</p>}
        </div>
      )}
    </Link>
  );
}
