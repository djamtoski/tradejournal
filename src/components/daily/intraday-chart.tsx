"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatPnl } from "@/lib/format";
import { formatTime } from "@/lib/tz";

type Point = { t: number; equity: number; pnl: number; symbol: string };

const axis = {
  stroke: "var(--faint)",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono)",
  tickLine: false,
  axisLine: false,
} as const;

function Tip({ active, payload, timezone }: TooltipContentProps & { timezone: string }) {
  if (!active || !payload?.length) return null;
  const clock = (t: number) => formatTime(new Date(t), timezone);
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-md border border-input bg-popover px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.4)]">
      <div className="mb-1 text-muted-foreground">
        {clock(p.t)} {p.symbol && `· ${p.symbol}`}
      </div>
      {p.symbol && (
        <div className="num flex justify-between gap-6">
          <span className="text-faint">Trade</span>
          <span className={p.pnl >= 0 ? "text-profit" : "text-loss"}>{formatPnl(p.pnl)}</span>
        </div>
      )}
      <div className="num flex justify-between gap-6">
        <span className="text-faint">Day</span>
        <span className="text-foreground">{formatPnl(p.equity)}</span>
      </div>
    </div>
  );
}

/** Running P&L through the day, stepping at each trade's close. */
export function IntradayChart({ data, timezone }: { data: Point[]; timezone: string }) {
  const clock = (t: number) => formatTime(new Date(t), timezone);
  const final = data.at(-1)?.equity ?? 0;
  const color = final >= 0 ? "var(--profit)" : "var(--loss)";
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dayFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.04)" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={clock}
          minTickGap={48}
          {...axis}
        />
        <YAxis
          tickFormatter={(n: number) => formatPnl(n)}
          width={64}
          {...axis}
        />
        <ReferenceLine y={0} stroke="rgb(255 255 255 / 0.1)" />
        <Tooltip content={(props) => <Tip {...props} timezone={timezone} />} cursor={{ stroke: "rgb(255 255 255 / 0.12)" }} />
        <Area
          type="stepAfter"
          dataKey="equity"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#dayFill)"
          activeDot={{ r: 3, strokeWidth: 0, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
