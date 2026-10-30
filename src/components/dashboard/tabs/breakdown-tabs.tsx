import { Panel } from "@/components/dashboard/card";
import { Breakdown, RBreakdown } from "@/components/dashboard/breakdown";
import {
  byAssetClass,
  byConfluence,
  byExitReason,
  byGrade,
  byHoldTime,
  byHour,
  byMistake,
  byPriceBucket,
  byRules,
  bySide,
  bySymbol,
  byTag,
  byTradesPerDay,
  byWeekday,
  byWeekOfMonth,
  rByTag,
} from "@/lib/stats";
import type { TabProps } from "./types";

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 pb-4 pt-1 text-[13px] text-faint">{children}</p>
);

export function TimeTab({ trades, filters: { mode } }: TabProps) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By weekday">
          <Breakdown rows={byWeekday(trades, mode)} />
        </Panel>
        <Panel title="By holding time" meta="Open to close">
          <Breakdown rows={byHoldTime(trades, mode)} />
        </Panel>
      </div>
      <Panel title="By entry hour">
        <Breakdown rows={byHour(trades, mode)} />
      </Panel>
    </>
  );
}

export function ActivityTab({ trades, filters: { mode } }: TabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="By trades taken that day" meta="Does trading more help?">
        <Breakdown rows={byTradesPerDay(trades, mode)} />
      </Panel>
      <Panel title="By week of the month">
        <Breakdown rows={byWeekOfMonth(trades, mode)} />
      </Panel>
    </div>
  );
}

export function SetupsTab({ trades, filters: { mode } }: TabProps) {
  const mistakes = byMistake(trades, mode);
  const rRows = rByTag(trades, mode);
  const grades = byGrade(trades, mode);
  const confluences = byConfluence(trades, mode);
  const graded = grades.some((r) => r.key !== "Not graded");
  const exits = byExitReason(trades, mode);
  const exitsSet = exits.some((r) => r.key !== "Not set");
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By setup">
          <Breakdown rows={byTag(trades, mode)} />
        </Panel>
        <Panel title="R by setup" meta="Average R · trades · total">
          {rRows.length ? (
            <RBreakdown rows={rRows} />
          ) : (
            <Empty>Add stops, or set 1R per account in Settings, to compare setups in R.</Empty>
          )}
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="By grade" meta="Win rate leaves out break-even trades">
          {graded ? <Breakdown rows={grades} /> : <Empty>Grade trades A+ to C in the trade editor to see which grades pay.</Empty>}
        </Panel>
        <Panel title="By confluence">
          {confluences.length ? (
            <Breakdown rows={confluences} />
          ) : (
            <Empty>Add tags to a &quot;Confluence&quot; group in Settings, then tag trades with them.</Empty>
          )}
        </Panel>
        <Panel title="How trades ended">
          {exitsSet ? <Breakdown rows={exits} /> : <Empty>Set how each trade ended (target, stop, break-even…) in the trade editor.</Empty>}
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Cost of mistakes">
          {mistakes.length ? <Breakdown rows={mistakes} /> : <Empty>Tag trades with a mistake to see what each one costs you.</Empty>}
        </Panel>
        <Panel title="Rules followed vs broken">
          <Breakdown rows={byRules(trades, mode)} />
        </Panel>
        <Panel title="Long vs short">
          <Breakdown rows={bySide(trades, mode).map((r) => ({ ...r, key: r.key === "long" ? "Long" : "Short" }))} />
        </Panel>
      </div>
    </>
  );
}

export function InstrumentsTab({ trades, filters: { mode } }: TabProps) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By symbol">
          <Breakdown rows={bySymbol(trades, mode)} />
        </Panel>
        <Panel title="By asset class">
          <Breakdown rows={byAssetClass(trades, mode)} />
        </Panel>
      </div>
      <Panel title="By entry price" meta="Futures quote in points, so index futures sit in the top bands">
        <Breakdown rows={byPriceBucket(trades, mode)} />
      </Panel>
    </>
  );
}
