import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/dashboard/card";
import { Annotator } from "@/components/screenshots/annotator";
import { ScreenshotDetailsForm } from "@/components/screenshots/details-form";
import { ScreenshotThumb } from "@/components/screenshots/thumb";
import { ScreenshotUploader } from "@/components/screenshots/uploader";
import { cn } from "@/lib/utils";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { getClosedTradesBetween, getLastTradeDate } from "@/lib/queries";
import { getScreenshots } from "@/lib/screenshots/queries";
import { formatPnl, pnlTone } from "@/lib/format";

export default function ScreenshotsPage({ searchParams }: PageProps<"/screenshots">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Screenshots searchParams={searchParams} />
    </Suspense>
  );
}

async function Screenshots({ searchParams }: { searchParams: PageProps<"/screenshots">["searchParams"] }) {
  const sp = await searchParams;
  const id = Number(typeof sp.id === "string" ? sp.id : NaN);
  if (Number.isInteger(id) && id > 0) return <Detail id={id} />;

  const day = typeof sp.day === "string" && parseDay(sp.day) ? sp.day : null;
  const tradeId = Number(typeof sp.trade === "string" ? sp.trade : NaN);
  const last = (await getLastTradeDate()) ?? new Date();
  const defaultDay = day ?? dayKey(new Date());

  // Trades from the last 120 days (and the chosen day) to link uploads to.
  const since = addDays(new Date(), -120);
  const [items, recent] = await Promise.all([
    getScreenshots(day ? { day } : {}),
    getClosedTradesBetween(since < last ? since : addDays(last, -120), null),
  ]);
  const tradeOptions = recent
    .slice()
    .reverse()
    .map((t) => ({
      id: t.id,
      day: dayKey(t.openedAt),
      label: `${t.openedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} ${t.symbol} ${t.side} · ${formatPnl(t.netPnl)}`,
    }));

  return (
    <>
      <PageHeader title="Screenshots">
        {day && (
          <Link href="/screenshots" className="text-[12px] text-faint hover:text-foreground">
            Showing {parseDay(day)!.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Show all
          </Link>
        )}
      </PageHeader>
      <div className="mx-auto flex max-w-[1300px] flex-col gap-6 p-6">
        <Panel title="Add a screenshot">
          <div className="px-4 pb-4 pt-2">
            <ScreenshotUploader
              trades={tradeOptions}
              defaultDay={defaultDay}
              defaultTradeId={Number.isInteger(tradeId) && tradeId > 0 ? tradeId : null}
            />
          </div>
        </Panel>

        {items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <ScreenshotThumb key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-[13px] text-faint">
            {day ? "No screenshots for this day yet." : "Your annotated charts will show up here."}
          </p>
        )}
      </div>
    </>
  );
}

async function Detail({ id }: { id: number }) {
  const [item] = await getScreenshots({ id });
  if (!item) {
    return (
      <>
        <PageHeader title="Screenshots" />
        <div className="mx-auto max-w-md p-6 text-center text-[13px] text-muted-foreground">
          That screenshot no longer exists.{" "}
          <Link href="/screenshots" className="text-foreground hover:underline">Back to screenshots</Link>
        </div>
      </>
    );
  }
  const date = item.day ? parseDay(item.day) : null;

  return (
    <>
      <PageHeader title="Screenshots">
        <Link href="/screenshots" className="flex items-center gap-1 text-[12px] text-faint hover:text-foreground">
          <ArrowLeft className="size-3.5" strokeWidth={1.5} /> All screenshots
        </Link>
      </PageHeader>
      <div className="mx-auto grid max-w-[1500px] items-start gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Annotator
          key={item.id}
          id={item.id}
          src={item.src}
          alt={item.caption ?? "Chart screenshot"}
          initial={item.annotations}
        />
        <Panel className="flex flex-col gap-4 p-4 xl:sticky xl:top-16">
          <dl className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Day</dt>
              <dd>
                {date ? (
                  <Link href={`/daily?date=${item.day}`} className="flex items-center gap-1 hover:text-foreground">
                    {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    <ArrowUpRight className="size-3 text-faint" strokeWidth={1.75} />
                  </Link>
                ) : (
                  <span className="text-faint">None</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Trade</dt>
              <dd>
                {item.trade ? (
                  <Link href={`/trades?range=all&trade=${item.trade.id}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <span className="font-medium">{item.trade.symbol}</span>
                    <span className={cn("num", pnlTone(item.trade.netPnl))}>{formatPnl(item.trade.netPnl)}</span>
                    <ArrowUpRight className="size-3 text-faint" strokeWidth={1.75} />
                  </Link>
                ) : (
                  <span className="text-faint">Whole day</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Added</dt>
              <dd className="num text-faint">
                {item.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </dd>
            </div>
          </dl>
          <ScreenshotDetailsForm key={item.id} id={item.id} caption={item.caption ?? ""} />
        </Panel>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto max-w-[1300px] p-6">
        <div className="h-[280px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
