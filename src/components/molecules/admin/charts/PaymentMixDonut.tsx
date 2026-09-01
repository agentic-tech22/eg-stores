"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { paymentMethodLabel } from "@/types/sale.types";
import type { PaymentBreakdownRow } from "@/utils/sales-analytics";
import {
  CHART_SERIES,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chart-theme";

interface PaymentMixDonutProps {
  data: PaymentBreakdownRow[];
  money: (n: number) => string;
  height?: number;
}

/** Revenue share by payment method as a themed donut with a legend. */
export function PaymentMixDonut({
  data,
  money,
  height = 248,
}: PaymentMixDonutProps) {
  const chartData = data.map((d) => ({
    name: paymentMethodLabel(d.method),
    value: d.revenue,
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_SERIES[i % CHART_SERIES.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => money(Number(value))}
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: CHART_TOOLTIP_STYLE.color }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, fontWeight: 600, color: CHART_TICK }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
