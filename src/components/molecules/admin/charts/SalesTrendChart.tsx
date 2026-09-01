"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/utils/sales-analytics";
import {
  CHART_GRID,
  CHART_PROFIT,
  CHART_REVENUE,
  CHART_TICK,
} from "./chart-theme";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-06-05" → "Jun 5" for axis ticks. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** Compact magnitude for the Y axis, e.g. 1200 → "1.2k". */
function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

/** Plain series rows, mapped out of recharts' (strictly-typed) payload. */
interface TooltipRow {
  name: string;
  value: number;
  color?: string;
}

function ChartTooltip({
  label,
  rows,
  money,
}: {
  label?: string | number;
  rows: TooltipRow[];
  money: (n: number) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="border-admin-border bg-admin-surface rounded-xl border px-3 py-2 shadow-lg shadow-black/5">
      <p className="mb-1 text-[11px] font-bold text-admin-text-muted">
        {typeof label === "string" ? shortDate(label) : ""}
      </p>
      {rows.map((row) => (
        <p
          key={row.name}
          className="flex items-center gap-2 text-xs font-semibold text-admin-text"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          {row.name}: {money(row.value)}
        </p>
      ))}
    </div>
  );
}

interface SalesTrendChartProps {
  data: DailyPoint[];
  money: (n: number) => string;
  /** Render the profit series too (gate on `finances.view`). */
  showProfit: boolean;
  height?: number;
}

/** Daily revenue (and optionally profit) as a themed area chart. */
export function SalesTrendChart({
  data,
  money,
  showProfit,
  height = 288,
}: SalesTrendChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dm-rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_REVENUE} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART_REVENUE} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dm-profit-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PROFIT} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_PROFIT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: CHART_TICK }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fontSize: 11, fill: CHART_TICK }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            content={({ active, label, payload }) => {
              if (!active) return null;
              const rows: TooltipRow[] = (payload ?? []).map((p) => ({
                name: String(p.name ?? ""),
                value: Number(p.value ?? 0),
                color: p.color,
              }));
              return <ChartTooltip label={label} rows={rows} money={money} />;
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={CHART_REVENUE}
            strokeWidth={2}
            fill="url(#dm-rev-fill)"
          />
          {showProfit && (
            <Area
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke={CHART_PROFIT}
              strokeWidth={2}
              fill="url(#dm-profit-fill)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
