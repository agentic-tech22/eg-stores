"use client";

import { useMemo, useState } from "react";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
import { useSales } from "@/hooks/sales/use-sales";
import { EmptyState, StatCard } from "@/components/molecules/admin";
import { SalesTrendChart } from "@/components/molecules/admin/charts/SalesTrendChart";
import { PaymentMixDonut } from "@/components/molecules/admin/charts/PaymentMixDonut";
import type { Sale } from "@/types/sale.types";
import { formatCurrency } from "@/utils/format-currency";
import {
  DATE_PRESETS,
  getPresetRange,
  getPreviousPresetRange,
  type DatePreset,
} from "@/utils/date-range";
import {
  byPaymentMethod,
  dailySeries,
  filterByRange,
  pctDelta,
  summarize,
  topProducts,
} from "@/utils/sales-analytics";
import { cn } from "@/utils/cn";

interface SalesPulseProps {
  initialSales: Sale[];
  currency: { code: string; locale: string };
  /** Whether the current user may see profit figures (`finances.view`). */
  canViewFinances: boolean;
}

/**
 * The date-scoped heart of the dashboard: preset pills drive KPI tiles (with
 * period-over-period deltas), a revenue/profit trend chart, top products, and
 * the payment-method mix, all recomputed for the selected range.
 */
export function SalesPulse({
  initialSales,
  currency,
  canViewFinances,
}: SalesPulseProps) {
  const { data: sales } = useSales(initialSales);
  const [preset, setPreset] = useState<DatePreset>("this_month");

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  const range = useMemo(() => getPresetRange(preset), [preset]);
  const prevRange = useMemo(() => getPreviousPresetRange(preset), [preset]);

  const filtered = useMemo(() => filterByRange(sales, range), [sales, range]);
  const previous = useMemo(
    () => filterByRange(sales, prevRange),
    [sales, prevRange],
  );

  const current = summarize(filtered);
  const baseline = summarize(previous);

  const series = useMemo(() => dailySeries(filtered, range), [filtered, range]);
  const byPayment = useMemo(() => byPaymentMethod(filtered), [filtered]);
  const top = useMemo(() => topProducts(filtered, 8), [filtered]);

  const hasSalesEver = sales.length > 0;

  return (
    <section>
      {/* Range pills: re-scope every figure below. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPreset(p.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              preset === p.value
                ? "bg-admin-accent text-white"
                : "bg-admin-surface text-admin-text-muted ring-1 ring-admin-border hover:text-admin-text",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI row with period-over-period deltas. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Product revenue"
          value={money(current.revenue)}
          icon={Wallet}
          tone="indigo"
          trend={pctDelta(current.revenue, baseline.revenue)}
        />
        {canViewFinances && (
          <StatCard
            label="Profit"
            value={money(current.profit)}
            icon={TrendingUp}
            tone="emerald"
            trend={pctDelta(current.profit, baseline.profit)}
          />
        )}
        <StatCard
          label="Sales"
          value={current.count}
          icon={Receipt}
          tone="accent"
          trend={pctDelta(current.count, baseline.count)}
        />
        <StatCard
          label="Avg. Sale"
          value={money(current.avgSale)}
          icon={Receipt}
          tone="amber"
          trend={pctDelta(current.avgSale, baseline.avgSale)}
        />
      </div>

      {!hasSalesEver ? (
        <EmptyState
          icon={TrendingUp}
          title="No sales yet"
          description="Once you record sales, your revenue trends and top products will appear here."
        />
      ) : (
        <>
          {/* Trend chart */}
          <div className="mb-6 rounded-2xl border border-admin-border bg-admin-surface p-5">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
              Sales{canViewFinances ? " & profit" : ""} trend
            </p>
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-admin-text-muted">
                No sales in this range.
              </div>
            ) : (
              <SalesTrendChart
                data={series}
                money={money}
                showProfit={canViewFinances}
              />
            )}
          </div>

          {/* Top products + payment mix */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
              <div className="border-b border-admin-border px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                  Top products by revenue
                </p>
              </div>
              {top.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-admin-text-muted">
                  No itemised products in this range.
                </div>
              ) : (
                <div className="divide-y divide-admin-border">
                  {top.map((row, i) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-admin-accent/10 text-[11px] font-bold text-admin-accent">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-admin-text">
                            {row.label}
                          </p>
                          <p className="text-[11px] text-admin-text-muted">
                            {row.qty} sold
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-admin-text">
                        {money(row.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
              <div className="border-b border-admin-border px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                  Payment mix
                </p>
              </div>
              {byPayment.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-admin-text-muted">
                  No sales in this range.
                </div>
              ) : (
                <div className="px-2 py-4">
                  <PaymentMixDonut data={byPayment} money={money} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
