import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Segment, Segmented } from "@/components/shell/page-header";
import { Panel } from "@/components/dashboard/card";
import { ReviewBody } from "@/components/review/review-body";
import { getReviews } from "@/lib/review/queries";
import { getSettings } from "@/lib/settings/queries";
import { addDaysKey, formatDateTime } from "@/lib/tz";

type Filter = "all" | "day" | "week";

export default function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  return (
    <Suspense fallback={<ReviewsSkeleton />}>
      <Reviews searchParams={searchParams} />
    </Suspense>
  );
}

const civil = (key: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
};

async function Reviews({ searchParams }: { searchParams: PageProps<"/reviews">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const filter: Filter = sp.period === "day" || sp.period === "week" ? sp.period : "all";
  const [reviews, { timezone }] = await Promise.all([getReviews(filter === "all" ? undefined : filter), getSettings()]);

  return (
    <>
      <PageHeader title="Reviews">
        <Segmented>
          <Segment href="/reviews" active={filter === "all"}>All</Segment>
          <Segment href="/reviews?period=day" active={filter === "day"}>Days</Segment>
          <Segment href="/reviews?period=week" active={filter === "week"}>Weeks</Segment>
        </Segmented>
      </PageHeader>

      <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-6">
        {reviews.length ? (
          reviews.map((r) => {
            const title =
              r.period === "day"
                ? civil(r.startDay, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                : `Week of ${civil(r.startDay, { month: "short", day: "numeric" })} – ${civil(addDaysKey(r.startDay, 6), { month: "short", day: "numeric", year: "numeric" })}`;
            const href = r.period === "day" ? `/daily?date=${r.startDay}` : `/calendar?month=${r.startDay.slice(0, 7)}`;
            return (
              <section key={r.id} id={`${r.period}-${r.startDay}`} className="scroll-mt-16">
                <Panel>
                  <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{r.period === "day" ? "Day" : "Week"}</span>
                      <Link href={href} className="text-[14px] text-foreground hover:underline underline-offset-2">{title}</Link>
                    </div>
                    <span className="num text-[12px] text-faint">Updated {formatDateTime(r.updatedAt, timezone)}</span>
                  </div>
                  <div className="px-4 py-3.5">
                    <ReviewBody content={r.content} />
                  </div>
                </Panel>
              </section>
            );
          })
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-20 text-center">
            <h2 className="text-[17px]">No reviews yet</h2>
            <p className="text-muted-foreground">
              Run <code className="num rounded bg-muted px-1.5 py-0.5 text-[12px] text-foreground">/review-trades</code> in Claude Code
              from this project. Claude reads the day&apos;s trades, journal, goals and playbook, writes a review and saves it here.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function ReviewsSkeleton() {
  return (
    <>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-6">
        <div className="h-[320px] animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
    </>
  );
}
