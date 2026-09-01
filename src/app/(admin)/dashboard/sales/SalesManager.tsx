"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useSales } from "@/hooks/sales/use-sales";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  TableRowsSkeleton,
} from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import { PermissionGate } from "@/components/auth/permission-context";
import type { Product, ProductVariant } from "@/types/product.types";
import {
  PAYMENT_METHODS,
  saleAmountDue,
  saleExtrasRevenue,
  saleItemsLabel,
  saleProfit,
  saleRevenue,
  type PaymentMethod,
  type Sale,
} from "@/types/sale.types";
import { formatCurrency } from "@/utils/format-currency";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { SaleFormModal } from "./SaleFormModal";
import { PaymentBadge, PaymentStatusBadge } from "./payment-badge";

const ITEMS_PER_PAGE = 10;

interface SalesManagerProps {
  initialSales: Sale[];
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  warehouses: Warehouse[];
  userDefaultWarehouseId?: string | null;
  availabilityByWarehouse: WarehouseAvailability;
  currency: { code: string; locale: string };
  can: { create: boolean };
}

export function SalesManager({
  initialSales,
  products,
  variantsByProduct,
  warehouses,
  userDefaultWarehouseId,
  availabilityByWarehouse,
  currency,
  can,
}: SalesManagerProps) {
  const { data: sales, isFetching } = useSales(initialSales);

  const [filterText, setFilterText] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "">("");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const money = (n: number) =>
    formatCurrency(n, currency.code, currency.locale);

  // Distinct creators present in the current sales, for the "created by" filter.
  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) if (s.createdByEmail) set.add(s.createdByEmail);
    return [...set].sort();
  }, [sales]);

  const filtered = useMemo(() => {
    let rows = sales;

    if (paymentFilter) {
      rows = rows.filter((s) => s.paymentMethod === paymentFilter);
    }

    if (staffFilter) {
      rows = rows.filter((s) => s.createdByEmail === staffFilter);
    }

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter((s) => {
        const items = [
          ...(s.items ?? []).map((it) => it.productTitle),
          ...(s.extras ?? []).map((it) => it.title),
        ]
          .join(" ")
          .toLowerCase();
        return (
          items.includes(q) ||
          (s.customerName?.toLowerCase().includes(q) ?? false) ||
          (s.customerPhone?.toLowerCase().includes(q) ?? false) ||
          (s.notes?.toLowerCase().includes(q) ?? false) ||
          String(s.saleNumber).includes(q)
        );
      });
    }

    return rows;
  }, [sales, paymentFilter, staffFilter, filterText]);

  // Stats reflect the current filter so the figures match what's on screen.
  // Revenue and profit are the PRODUCT side only: extra (non-catalog) lines are
  // totalled separately, and in full under Point of Sale → Extra Sales.
  const revenue = filtered.reduce((sum, s) => sum + saleRevenue(s), 0);
  const profit = filtered.reduce((sum, s) => sum + saleProfit(s), 0);
  const extrasRevenue = filtered.reduce((sum, s) => sum + saleExtrasRevenue(s), 0);
  const avgSale = filtered.length > 0 ? revenue / filtered.length : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
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
        title="Sales"
        description="Record in-person sales, track revenue, and monitor profit. Revenue and profit cover catalog products; extra sales are totalled under Extra Sales."
        actions={
          can.create && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Sale
            </button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales" value={filtered.length} icon={Receipt} />
        <StatCard
          label="Product revenue"
          value={money(revenue)}
          hint={
            extrasRevenue > 0
              ? `+ ${money(extrasRevenue)} extra sales`
              : undefined
          }
          icon={Wallet}
          tone="emerald"
        />
        <PermissionGate permission="finances.view">
          <StatCard
            label="Profit"
            value={money(profit)}
            icon={TrendingUp}
            tone="indigo"
          />
        </PermissionGate>
        <StatCard label="Avg. Sale" value={money(avgSale)} icon={Receipt} tone="amber" />
      </div>

      {/* Filter toolbar */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-2 rounded-2xl border border-admin-border bg-admin-surface px-4 sm:col-span-2">
          <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              resetPage();
            }}
            placeholder="Product, customer, phone, #..."
            aria-label="Search sales"
            className="w-full bg-transparent py-3 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>

        <Select
          value={paymentFilter}
          aria-label="Filter by payment method"
          onChange={(e) => {
            setPaymentFilter(e.target.value as PaymentMethod | "");
            resetPage();
          }}
        >
          <option value="">All payment methods</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>

        <Select
          value={staffFilter}
          aria-label="Filter by staff member"
          onChange={(e) => {
            setStaffFilter(e.target.value);
            resetPage();
          }}
        >
          <option value="">All staff</option>
          {staffOptions.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </Select>
      </div>

      {sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No sales yet"
          description="Record your first sale to start tracking revenue and profit."
          action={
            can.create && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                New Sale
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">#</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Items</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Payment</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Total</p>
            <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">View</p>
          </div>

          {isFetching && sales.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No sales match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginated.map((sale, i) => (
                <Link
                  key={sale.id}
                  href={`/dashboard/sales/${sale.id}`}
                  className="grid cursor-pointer grid-cols-1 gap-2 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                    {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                  </div>
                  <div className="col-span-1 text-sm font-bold text-admin-text">
                    #{sale.saleNumber}
                  </div>
                  <div className="col-span-2 text-sm text-admin-text">
                    {sale.saleDate.slice(0, 10)}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="truncate text-sm font-semibold text-admin-text">
                      {saleItemsLabel(sale)}
                    </p>
                    {(sale.customerName || sale.orderNumber !== null) && (
                      <p className="truncate text-[11px] text-admin-text-muted">
                        {sale.customerName}
                        {sale.orderNumber !== null &&
                          `${sale.customerName ? " · " : ""}from order #${sale.orderNumber}`}
                      </p>
                    )}
                    {sale.createdByEmail && (
                      <p className="truncate text-[11px] text-admin-text-muted">
                        by {sale.createdByEmail}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                    <PaymentBadge method={sale.paymentMethod} />
                    <PaymentStatusBadge status={sale.paymentStatus} />
                  </div>
                  <div className="col-span-2 text-sm font-bold text-admin-text">
                    {money(sale.total)}
                    {/* Only shown when money is still owed, so settled sales
                        stay uncluttered. */}
                    {saleAmountDue(sale) > 0 && (
                      <p className="text-[11px] font-bold text-amber-600">
                        {money(saleAmountDue(sale))} due
                      </p>
                    )}
                  </div>
                  <div className="col-span-1 text-right text-admin-accent">
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="sales"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {createOpen && (
        <SaleFormModal
          open
          onClose={() => setCreateOpen(false)}
          products={products}
          variantsByProduct={variantsByProduct}
          warehouses={warehouses}
          userDefaultWarehouseId={userDefaultWarehouseId}
          availabilityByWarehouse={availabilityByWarehouse}
          currency={currency}
        />
      )}
    </div>
  );
}
