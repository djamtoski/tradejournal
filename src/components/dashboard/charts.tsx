"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatPnl } from "@/lib/format";

type Point = { day: string; pnl: number; equity: number; trades: number };

const axis = {
  stroke: "var(--faint)",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono)",
  tickLine: false,
  axisLine: false,
} as const;

const grid = (
  <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.04)" />
);

const shortDate = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const compactMoney = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : Math.abs(n).toFixed(0)}`;

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-md border border-input bg-popover px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.4)]">
      <div className="mb-1 text-muted-foreground">{shortDate(p.day)}</div>
      <div className="num flex justify-between gap-6">
        <span className="text-faint">Day</span>
        <span className={p.pnl >= 0 ? "text-profit" : "text-loss"}>{formatPnl(p.pnl)}</span>
      </div>
      <div className="num flex justify-between gap-6">
        <span className="text-faint">Equity</span>
        <span className="text-foreground">{formatPnl(p.equity)}</span>
      </div>
      <div className="num flex justify-between gap-6">
        <span className="text-faint">Trades</span>
        <span className="text-foreground">{p.trades}</span>
      </div>
    </div>
  );
}

export function EquityChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="day" tickFormatter={shortDate} minTickGap={48} {...axis} />
        <YAxis tickFormatter={compactMoney} width={56} {...axis} />
        <ReferenceLine y={0} stroke="rgb(255 255 255 / 0.1)" />
        <Tooltip content={ChartTooltip} cursor={{ stroke: "rgb(255 255 255 / 0.12)" }} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="var(--primary)"
          strokeWidth={1.5}
          fill="url(#equityFill)"
          activeDot={{ r: 3, strokeWidth: 0, fill: "var(--primary)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type PeriodPoint = { key: string; label: string; pnl: number; equity: number; trades: number };

function PeriodTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PeriodPoint;
  return (
    <div className="rounded-md border border-input bg-popover px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.4)]">
      <div className="mb-1 text-muted-foreground">{p.label}</div>
      <div className="num flex justify-between gap-6">
        <span className="text-faint">P&L</span>
        <span className={p.pnl >= 0 ? "text-profit" : "text-loss"}>{formatPnl(p.pnl)}</span>
      </div>
      <div className="num flex justify-between gap-6">
        <span className="text-faint">Equity</span>
        <span className="text-foreground">{formatPnl(p.equity)}</span>
      </div>
      <div className="num flex justify-between gap-6">
        <span className="text-faint">Trades</span>
        <span className="text-foreground">{p.trades}</span>
      </div>
    </div>
  );
}

/** P&L bars per day, week or month (see groupedSeries). */
export function PnlBarsChart({ data }: { data: PeriodPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="label" minTickGap={48} {...axis} />
        <YAxis tickFormatter={compactMoney} width={56} {...axis} />
        <ReferenceLine y={0} stroke="rgb(255 255 255 / 0.1)" />
        <Tooltip content={PeriodTooltip} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
        <Bar dataKey="pnl" radius={[2, 2, 2, 2]} maxBarSize={data.length > 40 ? 14 : 32}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Trade counts per R bucket; loss buckets red, win buckets green. */
export function RDistributionChart({ data }: { data: { label: string; trades: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="label" interval={0} {...axis} />
        <YAxis allowDecimals={false} width={40} {...axis} />
        <Tooltip
          cursor={{ fill: "rgb(255 255 255 / 0.03)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-md border border-input bg-popover px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.4)]">
                <div className="text-muted-foreground">{(payload[0].payload as { label: string }).label}</div>
                <div className="num text-foreground">{payload[0].value} trades</div>
              </div>
            ) : null
          }
        />
        <Bar dataKey="trades" radius={[2, 2, 0, 0]} maxBarSize={36}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={i < 3 ? "var(--loss)" : "var(--profit)"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
