"use client";

import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import {
  useVendors,
  useVendorPurchases,
  useDeleteVendor,
} from "@/hooks/vendors/use-vendors";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import {
  EmptyState,
  PageHeader,
  Pagination,
  RowLink,
  StatCard,
  TableRowsSkeleton,
} from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import { notify } from "@/lib/toast";
import { describePayable } from "@/services/vendor-engine";
import type { VendorPurchase, VendorWithBalance } from "@/types/vendor.types";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";
import { VendorFormModal } from "./VendorFormModal";

const ITEMS_PER_PAGE = 8;

type RangePreset = "all" | "this-month" | "last-30" | "this-year" | "custom";

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-30", label: "Last 30 days" },
  { value: "this-year", label: "This year" },
  { value: "custom", label: "Custom" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Resolve a preset (or custom inputs) to inclusive `from`/`to` ISO date bounds. */
function resolveRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  const now = new Date();
  const today = iso(now);
  switch (preset) {
    case "this-month":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "last-30": {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { from: iso(start), to: today };
    }
    case "this-year":
      return { from: `${now.getFullYear()}-01-01`, to: today };
    case "custom":
      return { from: customFrom || null, to: customTo || null };
    case "all":
    default:
      return { from: null, to: null };
  }
}

interface VendorManagerProps {
  initialVendors: VendorWithBalance[];
  initialPurchases: VendorPurchase[];
  currency: { code: string; locale: string };
  can: { create: boolean; edit: boolean; delete: boolean };
}

export function VendorManager({
  initialVendors,
  initialPurchases,
  currency,
  can,
}: VendorManagerProps) {
  const { data: vendors, isFetching } = useVendors(initialVendors);
  const { data: purchases } = useVendorPurchases(initialPurchases);
  const deleteVendor = useDeleteVendor();
  const confirm = useConfirm();

  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendorWithBalance | null>(null);

  const [rangePreset, setRangePreset] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = resolveRange(rangePreset, customFrom, customTo);

  // Sum of bills per vendor whose date falls within the selected range.
  const purchasedByVendor = useMemo(() => {
    const map = new Map<string, number>();
    for (const bill of purchases) {
      if (from && bill.txnDate < from) continue;
      if (to && bill.txnDate > to) continue;
      map.set(bill.vendorId, (map.get(bill.vendorId) ?? 0) + bill.amount);
    }
    return map;
  }, [purchases, from, to]);

  const totalPurchased = useMemo(
    () => Array.from(purchasedByVendor.values()).reduce((a, b) => a + b, 0),
    [purchasedByVendor],
  );

  const totalOutstanding = vendors.reduce((sum, v) => sum + v.outstanding, 0);
  const totalPayable = describePayable(totalOutstanding);
  const query = filterText.toLowerCase();
  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(query) ||
      (v.code ?? "").toLowerCase().includes(query) ||
      (v.contactPerson ?? "").toLowerCase().includes(query) ||
      (v.phone ?? "").toLowerCase().includes(query),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(vendor: VendorWithBalance) {
    setEditing(vendor);
    setFormOpen(true);
  }

  async function handleDelete(vendor: VendorWithBalance) {
    const ok = await confirm({
      title: "Delete vendor",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">{vendor.name}</span>?
          This cannot be undone. Vendors with recorded bills or payments cannot
          be deleted. Deactivate them instead.
        </>
      ),
      confirmLabel: "Delete vendor",
      destructive: true,
    });
    if (!ok) return;
    deleteVendor.mutate(vendor.id, {
      onSuccess: () => notify.success("Vendor deleted."),
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Purchasing"
        title="Vendors"
        description="Track the suppliers you buy from, their tax details, and the balance you owe each of them."
        actions={
          can.create && (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Vendor
            </button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Vendors" value={vendors.length} icon={Truck} />
        <StatCard
          label="Purchased"
          value={formatCurrency(totalPurchased, currency.code, currency.locale)}
          icon={ShoppingBag}
          tone="indigo"
          hint={
            rangePreset === "all"
              ? "All bills, all time"
              : `Bills in selected range`
          }
        />
        <StatCard
          className="col-span-2 sm:col-span-1"
          label={totalPayable.isCredit ? "Total Advance / Credit" : "Total Payable"}
          value={formatCurrency(totalPayable.amount, currency.code, currency.locale)}
          icon={Wallet}
          tone={totalPayable.isCredit ? "emerald" : "amber"}
          hint={
            totalPayable.isCredit
              ? "Net prepaid balance held by vendors"
              : "Outstanding across all vendors"
          }
        />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-3.5">
          <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search vendors by name, code, contact, or phone..."
            aria-label="Filter vendors"
            className="h-full w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="hidden text-[11px] font-bold uppercase tracking-widest text-admin-text-muted sm:block">
            Purchases
          </label>
          <div className="flex-1 sm:w-44 sm:flex-none">
            <Select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as RangePreset)}
              aria-label="Purchase date range"
              className="h-11 font-semibold"
            >
              {RANGE_PRESETS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          {rangePreset === "custom" && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Purchases from date"
                className="h-11 min-w-0 flex-1 rounded-xl border border-admin-border bg-admin-surface px-3 text-sm text-admin-text focus:outline-none sm:flex-none"
              />
              <span className="text-sm text-admin-text-muted">-</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Purchases to date"
                className="h-11 min-w-0 flex-1 rounded-xl border border-admin-border bg-admin-surface px-3 text-sm text-admin-text focus:outline-none sm:flex-none"
              />
            </div>
          )}
        </div>
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vendors yet"
          description="Add your first vendor to start tracking bills and payments."
          action={
            can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Vendor
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Vendor</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Contact</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Purchased</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Payable</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          {isFetching && vendors.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No vendors match &ldquo;{filterText}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginated.map((vendor, i) => {
                const sn = (safePage - 1) * ITEMS_PER_PAGE + i + 1;
                const p = describePayable(vendor.outstanding);
                const purchased = purchasedByVendor.get(vendor.id) ?? 0;
                const payableColor = p.isCredit
                  ? "text-admin-success"
                  : p.amount > 0
                    ? "text-admin-danger"
                    : "text-admin-text";

                const actions =
                  can.edit || can.delete ? (
                    <ActionMenu
                      label={`Actions for ${vendor.name}`}
                      items={[
                        {
                          key: "edit",
                          label: "Edit vendor",
                          icon: Pencil,
                          onSelect: () => openEdit(vendor),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete vendor",
                          icon: Trash2,
                          onSelect: () => handleDelete(vendor),
                          disabled: deleteVendor.isPending,
                          destructive: true,
                          hidden: !can.delete,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  ) : (
                    <span className="text-[11px] italic text-admin-text-muted">
                      View only
                    </span>
                  );

                // Shared by the mobile card and the desktop row; opens the
                // vendor's detail page.
                const nameBlock = (
                  <RowLink
                    href={`/dashboard/vendors/${vendor.id}`}
                    label={`View ${vendor.name}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-admin-text transition-colors group-hover:text-admin-accent">
                        {vendor.name}
                      </p>
                      <div className="flex items-center gap-2">
                        {vendor.code && (
                          <span className="truncate text-[11px] text-admin-text-muted">
                            {vendor.code}
                          </span>
                        )}
                        {!vendor.isActive && (
                          <span className="inline-flex w-fit items-center rounded-full bg-admin-text-muted/15 px-2 py-0.5 text-[10px] font-bold text-admin-text-muted">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </RowLink>
                );

                return (
                  <div
                    key={vendor.id}
                    className="px-5 py-3.5 transition-colors hover:bg-admin-card/30"
                  >
                    {/* Mobile: stacked card with labels */}
                    <div className="sm:hidden">
                      <div className="flex items-start justify-between gap-3">
                        {nameBlock}
                        <div className="shrink-0">{actions}</div>
                      </div>
                      {(vendor.contactPerson || vendor.phone || vendor.email) && (
                        <p className="mt-1 truncate text-[11px] text-admin-text-muted">
                          {[vendor.contactPerson, vendor.phone ?? vendor.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-admin-border pt-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-admin-text-muted">
                            Purchased
                          </p>
                          <p className="truncate text-sm font-bold text-admin-text">
                            {formatCurrency(purchased, currency.code, currency.locale)}
                          </p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-admin-text-muted">
                            {p.isCredit ? "Credit" : "Payable"}
                          </p>
                          <p className={cn("truncate text-sm font-bold", payableColor)}>
                            {formatCurrency(p.amount, currency.code, currency.locale)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: 12-col table row */}
                    <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                      <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                        {sn}
                      </div>
                      <div className="col-span-3">{nameBlock}</div>
                      <div className="col-span-2 min-w-0">
                        <p className="truncate text-sm text-admin-text">
                          {vendor.contactPerson ?? "N/A"}
                        </p>
                        <p className="truncate text-[11px] text-admin-text-muted">
                          {vendor.phone ?? vendor.email ?? ""}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-bold text-admin-text">
                          {formatCurrency(purchased, currency.code, currency.locale)}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={cn("text-sm font-bold", payableColor)}>
                          {formatCurrency(p.amount, currency.code, currency.locale)}
                        </span>
                        {p.isCredit && (
                          <p className="text-[10px] font-bold uppercase tracking-wide text-admin-success">
                            Credit
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        {actions}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="vendors"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {formOpen && (
        <VendorFormModal
          key={editing?.id ?? "new"}
          open
          vendor={editing}
          currency={currency}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
