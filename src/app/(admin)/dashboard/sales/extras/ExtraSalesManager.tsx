"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Layers,
  Search,
  SquarePen,
  Wallet,
} from "lucide-react";
import { useSales } from "@/hooks/sales/use-sales";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
} from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import {
  saleAmountSplit,
  type ExtraSaleItem,
  type Sale,
} from "@/types/sale.types";
import { formatCurrency } from "@/utils/format-currency";
import {
  DATE_PRESETS,
  getPresetRange,
  type DatePreset,
} from "@/utils/date-range";
import { filterByRange, topExtras, type DateRange } from "@/utils/sales-analytics";
import { cn } from "@/utils/cn";

const ITEMS_PER_PAGE = 15;

interface ExtraSalesManagerProps {
  initialSales: Sale[];
  currency: { code: string; locale: string };
}

/** One extra line, flattened out of its parent sale for the table. */
interface ExtraRow {
  extra: ExtraSaleItem;
  sale: Sale;
}

/**
 * Extra Sales: every non-catalog line the counter has billed, listed on its own.
 *
 * These lines are charged on ordinary sales but stored apart from `sale_items`,
 * so they never reach product revenue, product profit or Top Products. This page
 * is where they are accounted for instead — which is why its own totals stand
 * alone and are never mixed into the product figures on Sales or Analytics.
 */
export function ExtraSalesManager({
  initialSales,
  currency,
}: ExtraSalesManagerProps) {
  const { data: sales } = useSales(initialSales);

  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [filterText, setFilterText] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const money = (n: number) =>
    formatCurrency(n, currency.code, currency.locale);

  const inRange = useMemo(() => {
    const range: DateRange | null = getPresetRange(preset);
    return filterByRange(sales, range);
  }, [sales, preset]);

  // Every extra line in the range, newest sale first (the parent list is already
  // ordered that way).
  const allRows = useMemo(() => {
    const rows: ExtraRow[] = [];
    for (const sale of inRange) {
      for (const extra of sale.extras ?? []) rows.push({ extra, sale });
    }
    return rows;
  }, [inRange]);

  // Distinct item names in the range, so a recurring charge can be isolated.
  const titleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) set.add(r.extra.title);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const rows = useMemo(() => {
    let out = allRows;
    if (titleFilter) out = out.filter((r) => r.extra.title === titleFilter);
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      out = out.filter(
        (r) =>
          r.extra.title.toLowerCase().includes(q) ||
          (r.sale.customerName?.toLowerCase().includes(q) ?? false) ||
          (r.sale.customerPhone?.toLowerCase().includes(q) ?? false) ||
          String(r.sale.saleNumber).includes(q),
      );
    }
    return out;
  }, [allRows, titleFilter, filterText]);

  // Gross value of the visible lines. Kept gross because a line's own value is
  // what it was rung up for; a sale-level discount belongs to the sale.
  const grossRevenue = rows.reduce((sum, r) => sum + r.extra.lineTotal, 0);
  const units = rows.reduce((sum, r) => sum + r.extra.quantity, 0);
  const saleCount = new Set(rows.map((r) => r.sale.id)).size;

  const top = useMemo(() => topExtras(inRange, 6), [inRange]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = rows.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  function resetPage() {
    setCurrentPage(1);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Point of sale"
        title="Extra Sales"
        description="One-off counter charges that aren't in the catalog — service fees, repair labour, delivery. Billed on the sale, but kept out of product revenue and profit so product reporting stays clean."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              setPreset(p.value);
              resetPage();
            }}
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

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Extra revenue"
          value={money(grossRevenue)}
          hint="Not counted in product revenue"
          icon={Wallet}
          tone="emerald"
        />
        <StatCard label="Items sold" value={units} icon={SquarePen} tone="amber" />
        <StatCard
          label="Sales involved"
          value={saleCount}
          hint={`${rows.length} ${rows.length === 1 ? "line" : "lines"}`}
          icon={Layers}
        />
      </div>

      {/* Filter toolbar */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-2xl border border-admin-border bg-admin-surface px-4 sm:col-span-2">
          <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              resetPage();
            }}
            placeholder="Item, customer, phone, sale #..."
            aria-label="Search extra sales"
            className="w-full bg-transparent py-3 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>

        <Select
          value={titleFilter}
          aria-label="Filter by item"
          onChange={(e) => {
            setTitleFilter(e.target.value);
            resetPage();
          }}
        >
          <option value="">All items</option>
          {titleOptions.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </Select>
      </div>

      {allRows.length === 0 ? (
        <EmptyState
          icon={SquarePen}
          title="No extra sales in this range"
          description="Add one from the POS with “Add extra item” when you sell something that isn't in the catalog, like a repair charge or a delivery fee."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface lg:col-span-2">
            <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
              <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Item</p>
              <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
              <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Qty × Price</p>
              <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Total</p>
              <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Sale</p>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
                No extra sales match the current filters.
              </div>
            ) : (
              <div className="divide-y divide-admin-border">
                {paginated.map(({ extra, sale }) => {
                  // Surfaced per line so a discounted bill doesn't read as if
                  // the full amount was collected for this charge.
                  const share = saleAmountSplit(sale).extrasDiscount;
                  return (
                    <Link
                      key={extra.id}
                      href={`/dashboard/sales/${sale.id}`}
                      className="grid cursor-pointer grid-cols-1 gap-2 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="truncate text-sm font-semibold text-admin-text">
                          {extra.title}
                        </p>
                        {(sale.customerName || sale.createdByEmail) && (
                          <p className="truncate text-[11px] text-admin-text-muted">
                            {sale.customerName}
                            {sale.customerName && sale.createdByEmail ? " · " : ""}
                            {sale.createdByEmail ? `by ${sale.createdByEmail}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-admin-text">
                        {sale.saleDate.slice(0, 10)}
                      </div>
                      <div className="col-span-2 text-sm text-admin-text">
                        {extra.quantity} × {money(extra.unitPrice)}
                      </div>
                      <div className="col-span-3 text-sm font-bold text-admin-text">
                        {money(extra.lineTotal)}
                        {share > 0 && (
                          <p className="text-[11px] font-semibold text-amber-600">
                            {money(share)} discount on this sale
                          </p>
                        )}
                      </div>
                      <div className="col-span-1 text-right text-[11px] font-bold text-admin-accent">
                        <span className="inline-flex items-center gap-0.5">
                          #{sale.saleNumber}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={rows.length}
              pageSize={ITEMS_PER_PAGE}
              itemLabel="extra sales"
              onPageChange={setCurrentPage}
            />
          </div>

          {/* Top earners, so a recurring charge is easy to spot. */}
          <div className="h-fit overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
            <div className="border-b border-admin-border px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                Top extra items
              </p>
            </div>
            <div className="divide-y divide-admin-border">
              {top.map((row) => (
                <div
                  key={row.title}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-admin-text">
                      {row.title}
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
          </div>
        </div>
      )}
    </div>
  );
}
