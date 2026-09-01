/**
 * Pure aggregation helpers for sales data, shared by the dashboard overview and
 * the analytics page so both compute identical numbers from one source.
 * Everything here is permission-agnostic: callers decide whether to surface
 * profit (a `finances.view`-gated figure).
 *
 * Every revenue figure here is PRODUCT revenue — `saleRevenue`, not
 * `sale.total`. Extra sales (non-catalog counter lines: service charges, fees,
 * repair labour) are deliberately excluded from all of it, along with their
 * share of the discount, so product performance is never flattered by lines
 * that carry no cost. They are reported on their own under
 * Point of Sale → Extra Sales; `summarizeExtras` is the figure that page uses.
 */

import {
  saleExtrasRevenue,
  saleProfit,
  saleRevenue,
  type PaymentMethod,
  type Sale,
} from "@/types/sale.types";
import { toLocalDateStr } from "@/utils/date-range";

export interface DateRange {
  start: string;
  end: string;
}

/** Sales whose `saleDate` falls within [range], inclusive. Null range = all. */
export function filterByRange(sales: Sale[], range: DateRange | null): Sale[] {
  if (!range) return sales;
  return sales.filter((s) => {
    const d = s.saleDate.slice(0, 10);
    return d >= range.start && d <= range.end;
  });
}

export interface SalesSummary {
  count: number;
  revenue: number;
  profit: number;
  avgSale: number;
}

/** Headline product totals across a set of sales (extra sales excluded). */
export function summarize(sales: Sale[]): SalesSummary {
  const revenue = sales.reduce((sum, s) => sum + saleRevenue(s), 0);
  const profit = sales.reduce((sum, s) => sum + saleProfit(s), 0);
  const count = sales.length;
  return { count, revenue, profit, avgSale: count > 0 ? revenue / count : 0 };
}

export interface ExtrasSummary {
  /** Number of sales that carried at least one extra line. */
  saleCount: number;
  /** Number of individual extra lines. */
  lineCount: number;
  /** Units across those lines. */
  quantity: number;
  /** Revenue from extra lines, net of their share of each sale's discount. */
  revenue: number;
}

/**
 * Totals for the extra (non-catalog) side of a set of sales. Deliberately
 * separate from `summarize`: these two are never added together in the product
 * views, which is the whole point of keeping extras in their own table.
 */
export function summarizeExtras(sales: Sale[]): ExtrasSummary {
  let saleCount = 0;
  let lineCount = 0;
  let quantity = 0;
  let revenue = 0;
  for (const s of sales) {
    const extras = s.extras ?? [];
    if (extras.length === 0) continue;
    saleCount += 1;
    lineCount += extras.length;
    quantity += extras.reduce((sum, e) => sum + e.quantity, 0);
    revenue += saleExtrasRevenue(s);
  }
  return { saleCount, lineCount, quantity, revenue };
}

export interface TopExtraRow {
  title: string;
  qty: number;
  revenue: number;
}

/**
 * Extra lines grouped by title, biggest earner first. Gross of the sale
 * discount: a line's own value is what it was rung up for, and the discount
 * belongs to the sale, not to any one line.
 */
export function topExtras(sales: Sale[], limit = 8): TopExtraRow[] {
  const map = new Map<string, TopExtraRow>();
  for (const s of sales) {
    for (const e of s.extras ?? []) {
      const entry = map.get(e.title) ?? { title: e.title, qty: 0, revenue: 0 };
      entry.qty += e.quantity;
      entry.revenue += e.lineTotal;
      map.set(e.title, entry);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface PaymentBreakdownRow {
  method: PaymentMethod;
  count: number;
  revenue: number;
}

/** Revenue + count grouped by payment method, sorted by revenue descending. */
export function byPaymentMethod(sales: Sale[]): PaymentBreakdownRow[] {
  const map = new Map<PaymentMethod, { count: number; revenue: number }>();
  for (const s of sales) {
    const entry = map.get(s.paymentMethod) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += saleRevenue(s);
    map.set(s.paymentMethod, entry);
  }
  return [...map.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Only the sales fulfilled from `warehouseId` (null = all warehouses). */
export function filterByWarehouse(
  sales: Sale[],
  warehouseId: string | null,
): Sale[] {
  if (!warehouseId) return sales;
  return sales.filter((s) => s.warehouseId === warehouseId);
}

export interface WarehouseBreakdownRow {
  warehouseId: string;
  count: number;
  revenue: number;
  profit: number;
}

/** Count, revenue, and profit grouped by warehouse, sorted by revenue desc. */
export function byWarehouse(sales: Sale[]): WarehouseBreakdownRow[] {
  const map = new Map<string, { count: number; revenue: number; profit: number }>();
  for (const s of sales) {
    const entry = map.get(s.warehouseId) ?? { count: 0, revenue: 0, profit: 0 };
    entry.count += 1;
    entry.revenue += saleRevenue(s);
    entry.profit += saleProfit(s);
    map.set(s.warehouseId, entry);
  }
  return [...map.entries()]
    .map(([warehouseId, v]) => ({ warehouseId, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface TopProductRow {
  label: string;
  qty: number;
  revenue: number;
}

/** Top products by revenue, aggregated across every line item in the set. */
export function topProducts(sales: Sale[], limit = 8): TopProductRow[] {
  const map = new Map<string, TopProductRow>();
  for (const s of sales) {
    for (const it of s.items ?? []) {
      const label = it.variantLabel
        ? `${it.productTitle} (${it.variantLabel})`
        : it.productTitle;
      const entry = map.get(label) ?? { label, qty: 0, revenue: 0 };
      entry.qty += it.quantity;
      entry.revenue += it.lineTotal;
      map.set(label, entry);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface DailyPoint {
  date: string;
  revenue: number;
  profit: number;
}

/**
 * Revenue + profit bucketed per calendar day across [range], with empty days
 * filled to 0 so the trend line stays continuous. When `range` is null, the
 * span runs from the earliest to the latest sale present. Capped at ~2 years of
 * days to keep the array bounded for very wide ("all time") spans.
 */
export function dailySeries(
  sales: Sale[],
  range: DateRange | null,
): DailyPoint[] {
  const buckets = new Map<string, { revenue: number; profit: number }>();
  for (const s of sales) {
    const d = s.saleDate.slice(0, 10);
    const entry = buckets.get(d) ?? { revenue: 0, profit: 0 };
    entry.revenue += saleRevenue(s);
    entry.profit += saleProfit(s);
    buckets.set(d, entry);
  }

  let start = range?.start;
  let end = range?.end;
  if (!start || !end) {
    const dates = [...buckets.keys()].sort();
    if (dates.length === 0) return [];
    start = start ?? dates[0];
    end = end ?? dates[dates.length - 1];
  }

  const out: DailyPoint[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let guard = 0;
  while (cursor <= last && guard < 732) {
    const key = toLocalDateStr(cursor);
    const b = buckets.get(key) ?? { revenue: 0, profit: 0 };
    out.push({ date: key, revenue: b.revenue, profit: b.profit });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return out;
}

/**
 * Signed percentage change from `previous` to `current`. Returns null when there
 * is no meaningful baseline (previous is 0 while current is not), and 0 when
 * both are 0.
 */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
