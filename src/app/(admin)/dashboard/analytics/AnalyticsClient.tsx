"use client";

import { useMemo, useState } from "react";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
import { useSales } from "@/hooks/sales/use-sales";
import { EmptyState, PageHeader, StatCard } from "@/components/molecules/admin";
import { PermissionGate } from "@/components/auth/permission-context";
import { Select } from "@/components/molecules/form";
import { paymentMethodLabel, type Sale } from "@/types/sale.types";
import type { Warehouse } from "@/types/warehouse.types";
import { formatCurrency } from "@/utils/format-currency";
import {
  DATE_PRESETS,
  getPresetRange,
  type DatePreset,
} from "@/utils/date-range";
import {
  byPaymentMethod,
  byWarehouse,
  filterByRange,
  filterByWarehouse,
  summarize,
  summarizeExtras,
  topProducts,
  type DateRange,
} from "@/utils/sales-analytics";
import { cn } from "@/utils/cn";

interface AnalyticsClientProps {
  initialSales: Sale[];
  warehouses: Warehouse[];
  currency: { code: string; locale: string };
}

export function AnalyticsClient({
  initialSales,
  warehouses,
  currency,
}: AnalyticsClientProps) {
  const { data: sales } = useSales(initialSales);

  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("");

  const money = (n: number) =>
    formatCurrency(n, currency.code, currency.locale);
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? "Unknown";

  // A custom from/to range, when present, overrides the preset pills. Open-ended
  // bounds use lexically-safe YYYY-MM-DD sentinels so a single side still works.
  const usingCustom = Boolean(customFrom || customTo);

  const filtered = useMemo(() => {
    const range: DateRange | null = usingCustom
      ? { start: customFrom || "0000-01-01", end: customTo || "9999-12-31" }
      : getPresetRange(preset);
    return filterByWarehouse(filterByRange(sales, range), warehouseId || null);
  }, [sales, usingCustom, customFrom, customTo, preset, warehouseId]);

  const { count, revenue, profit, avgSale } = summarize(filtered);
  // Extra (non-catalog) sales are excluded from every figure above. Surfaced
  // here only as a pointer, so the number isn't invisible from this page.
  const extras = useMemo(() => summarizeExtras(filtered), [filtered]);

  const byPayment = useMemo(() => byPaymentMethod(filtered), [filtered]);
  const byWh = useMemo(() => byWarehouse(filtered), [filtered]);
  const topProductRows = useMemo(() => topProducts(filtered, 8), [filtered]);

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Revenue, profit, and product performance over a date range. Catalog products only — extra sales are reported under Point of Sale → Extra Sales."
      />

      {/* Date range controls */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setPreset(p.value);
                setCustomFrom("");
                setCustomTo("");
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                !usingCustom && preset === p.value
                  ? "bg-admin-accent text-white"
                  : "bg-admin-surface text-admin-text-muted ring-1 ring-admin-border hover:text-admin-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            aria-label="From date"
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5 text-sm text-admin-text focus:outline-none"
          />
          <span className="text-xs text-admin-text-muted">to</span>
          <input
            type="date"
            value={customTo}
            aria-label="To date"
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5 text-sm text-admin-text focus:outline-none"
          />
          {usingCustom && (
            <button
              type="button"
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/10"
            >
              Clear
            </button>
          )}
          {warehouses.length > 1 && (
            <div className="w-48">
              <Select
                value={warehouseId}
                aria-label="Filter by warehouse"
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales" value={count} icon={Receipt} />
        <StatCard
          label="Product revenue"
          value={money(revenue)}
          hint={
            extras.revenue > 0
              ? `+ ${money(extras.revenue)} extra sales`
              : undefined
          }
          icon={Wallet}
          tone="emerald"
        />
        <PermissionGate permission="finances.view">
          <StatCard label="Profit" value={money(profit)} icon={TrendingUp} tone="indigo" />
        </PermissionGate>
        <StatCard label="Avg. Sale" value={money(avgSale)} icon={Receipt} tone="amber" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No sales in this range"
          description="Pick a different date range to see analytics."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By payment method */}
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
            <div className="border-b border-admin-border px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                By payment method
              </p>
            </div>
            <div className="divide-y divide-admin-border">
              {byPayment.map((row) => (
                <div
                  key={row.method}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-admin-text">
                      {paymentMethodLabel(row.method)}
                    </p>
                    <p className="text-[11px] text-admin-text-muted">
                      {row.count} {row.count === 1 ? "sale" : "sales"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-admin-text">
                    {money(row.revenue)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* By warehouse */}
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
            <div className="border-b border-admin-border px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                By warehouse
              </p>
            </div>
            <div className="divide-y divide-admin-border">
              {byWh.map((row) => (
                <div
                  key={row.warehouseId}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-admin-text">
                      {warehouseName(row.warehouseId)}
                    </p>
                    <p className="text-[11px] text-admin-text-muted">
                      {row.count} {row.count === 1 ? "sale" : "sales"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-admin-text">
                      {money(row.revenue)}
                    </p>
                    <PermissionGate permission="finances.view">
                      <p className="text-[11px] text-emerald-600">
                        {money(row.profit)} profit
                      </p>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top products */}
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
            <div className="border-b border-admin-border px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                Top products by revenue
              </p>
            </div>
            {topProductRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-admin-text-muted">
                No itemised products in this range.
              </div>
            ) : (
              <div className="divide-y divide-admin-border">
                {topProductRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-admin-text">
                        {row.label}
                      </p>
                      <p className="text-[11px] text-admin-text-muted">
                        {row.qty} sold
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-admin-text">
                      {money(row.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
