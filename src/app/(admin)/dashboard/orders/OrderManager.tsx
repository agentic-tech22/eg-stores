"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Plus,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useOrders } from "@/hooks/orders/use-orders";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  TableRowsSkeleton,
} from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import type { NcmDeliveryType } from "@/types/ncm.types";
import type { Product, ProductVariant } from "@/types/product.types";
import type { Order, OrderSource, OrderStatus } from "@/types/order.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { formatCurrency } from "@/utils/format-currency";
import { CreateOrderModal } from "./CreateOrderModal";
import { BulkShipToNcmModal } from "./BulkShipToNcmModal";
import { NcmStatusBadge, OrderStatusBadge, PaymentBadge } from "./status-badges";

const ITEMS_PER_PAGE = 10;

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** An order can be dispatched to NCM if it isn't already shipped or cancelled. */
function isShippable(order: Order): boolean {
  return !order.ncmOrderId && order.status !== "cancelled";
}

interface OrderManagerProps {
  initialOrders: Order[];
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  warehouses: Warehouse[];
  availabilityByWarehouse: WarehouseAvailability;
  currency: { code: string; locale: string };
  can: { create: boolean; ship: boolean };
  ncmDefaults: {
    fromBranch: string | null;
    deliveryType: NcmDeliveryType;
    codCharge: number;
  };
}

export function OrderManager({
  initialOrders,
  products,
  variantsByProduct,
  warehouses,
  availabilityByWarehouse,
  currency,
  can,
  ncmDefaults,
}: OrderManagerProps) {
  const { data: orders, isFetching } = useOrders(initialOrders);

  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<OrderSource | "">("");
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const shippedCount = orders.filter((o) => o.status === "shipped").length;

  const filtered = useMemo(() => {
    let rows = orders;

    if (statusFilter) rows = rows.filter((o) => o.status === statusFilter);
    if (sourceFilter) rows = rows.filter((o) => o.source === sourceFilter);

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          String(o.orderNumber).includes(q),
      );
    }

    return rows;
  }, [orders, statusFilter, sourceFilter, filterText]);

  function resetPage() {
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const selectable = can.ship;
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds],
  );
  // Header checkbox toggles every order matching the current filters.
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((o) => next.delete(o.id));
      else filtered.forEach((o) => next.add(o.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Track customer orders and dispatch them via NCM courier."
        actions={
          can.create && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Order
            </button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={orders.length} icon={ShoppingCart} />
        <StatCard label="Pending" value={pendingCount} icon={ShoppingCart} tone="amber" />
        <StatCard label="Shipped" value={shippedCount} icon={Truck} tone="indigo" />
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
            placeholder="Name, phone, #..."
            aria-label="Search orders"
            className="w-full bg-transparent py-3 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>

        <Select
          value={statusFilter}
          aria-label="Filter by status"
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "");
            resetPage();
          }}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </Select>

        <Select
          value={sourceFilter}
          aria-label="Filter by source"
          onChange={(e) => {
            setSourceFilter(e.target.value as OrderSource | "");
            resetPage();
          }}
        >
          <option value="">All sources</option>
          <option value="admin">Admin</option>
          <option value="storefront">Storefront</option>
        </Select>
      </div>

      {selectable && selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-accent/40 bg-admin-accent/5 px-4 py-3">
          <p className="text-sm font-semibold text-admin-text">
            {selectedIds.size} selected
            <span className="ml-2 text-xs font-medium text-admin-text-muted">
              {selectedOrders.filter(isShippable).length} ready to ship ·{" "}
              {selectedOrders.filter((o) => !isShippable(o)).length} skipped
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center gap-1.5 rounded-xl border border-admin-border px-3 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              disabled={selectedOrders.filter(isShippable).length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-admin-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
            >
              <Truck className="h-4 w-4" strokeWidth={2.5} />
              Ship to NCM
            </button>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="Orders created here or placed from the storefront will appear in this list."
          action={
            can.create && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                New Order
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            {selectable ? (
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  aria-label="Select all filtered orders"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 cursor-pointer rounded border-admin-border accent-admin-accent"
                />
              </div>
            ) : (
              <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            )}
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">#</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Customer</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Total</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Status</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Courier</p>
            <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">View</p>
          </div>

          {isFetching && orders.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No orders match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginated.map((order, i) => (
                <div
                  key={order.id}
                  className="grid grid-cols-1 gap-2 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  {selectable ? (
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        aria-label={`Select order #${order.orderNumber}`}
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="h-4 w-4 cursor-pointer rounded border-admin-border accent-admin-accent"
                      />
                    </div>
                  ) : (
                    <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                      {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                    </div>
                  )}
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="contents cursor-pointer"
                  >
                  <div className="col-span-1 text-sm font-bold text-admin-text">
                    #{order.orderNumber}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="truncate text-sm font-semibold text-admin-text">
                      {order.customerName}
                    </p>
                    <p className="truncate text-[11px] text-admin-text-muted">
                      {order.customerPhone}
                      {order.source === "storefront" && " · storefront"}
                      {order.channel === "shop" && " · shop"}
                    </p>
                  </div>
                  <div className="col-span-2 text-sm font-bold text-admin-text">
                    {formatCurrency(order.total, currency.code, currency.locale)}
                    <div className="mt-1">
                      <PaymentBadge
                        method={order.paymentMethod}
                        status={order.paymentStatus}
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <OrderStatusBadge status={order.status} />
                    {order.convertedSale && (
                      <p className="mt-1 text-[11px] font-semibold text-admin-text-muted">
                        → Sale #{order.convertedSale.saleNumber}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <NcmStatusBadge status={order.ncmStatus} />
                  </div>
                  <div className="col-span-1 text-right text-admin-accent">
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="orders"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {createOpen && (
        <CreateOrderModal
          open
          onClose={() => setCreateOpen(false)}
          products={products}
          variantsByProduct={variantsByProduct}
          warehouses={warehouses}
          availabilityByWarehouse={availabilityByWarehouse}
          currency={currency}
        />
      )}

      {bulkOpen && (
        <BulkShipToNcmModal
          open
          onClose={() => setBulkOpen(false)}
          orders={selectedOrders}
          onShipped={clearSelection}
          defaults={ncmDefaults}
        />
      )}
    </div>
  );
}
