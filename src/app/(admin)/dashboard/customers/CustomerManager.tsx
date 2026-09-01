"use client";

import { useState } from "react";
import {
  Pencil,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCustomers, useDeleteCustomer } from "@/hooks/customers/use-customers";
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
import { notify } from "@/lib/toast";
import type { CustomerWithBalance } from "@/types/customer.types";
import { CustomerFormModal } from "./CustomerFormModal";
import { MembershipQrModal } from "./MembershipQrModal";

const ITEMS_PER_PAGE = 8;

interface CustomerManagerProps {
  initialCustomers: CustomerWithBalance[];
  can: { create: boolean; edit: boolean; delete: boolean };
  /** Business profile shop name, printed on the membership QR card. */
  shopName: string | null;
}

export function CustomerManager({
  initialCustomers,
  can,
  shopName,
}: CustomerManagerProps) {
  const { data: customers, isFetching } = useCustomers(initialCustomers);
  const deleteCustomer = useDeleteCustomer();
  const confirm = useConfirm();

  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerWithBalance | null>(null);

  const activeCount = customers.filter((c) => c.isActive).length;
  const totalPoints = customers.reduce((sum, c) => sum + c.pointsBalance, 0);

  const query = filterText.toLowerCase();
  const filtered = customers.filter(
    (c) =>
      (c.name ?? "").toLowerCase().includes(query) ||
      (c.phone ?? "").toLowerCase().includes(query) ||
      (c.email ?? "").toLowerCase().includes(query),
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

  function openEdit(customer: CustomerWithBalance) {
    setEditing(customer);
    setFormOpen(true);
  }

  async function handleDelete(customer: CustomerWithBalance) {
    const ok = await confirm({
      title: "Delete customer",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">
            {customer.name ?? customer.phone ?? "this customer"}
          </span>
          ? This cannot be undone. Customers with a loyalty history cannot be
          deleted. Deactivate them instead.
        </>
      ),
      confirmLabel: "Delete customer",
      destructive: true,
    });
    if (!ok) return;
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => notify.success("Customer deleted."),
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Customers"
        description="Your customer directory, created automatically from point-of-sale transactions and managed here, with loyalty points for each."
        actions={
          <>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-4 py-2.5 text-sm font-bold text-admin-text-secondary shadow-sm transition-colors hover:bg-admin-card hover:text-admin-text"
            >
              <QrCode className="h-4 w-4" strokeWidth={2.5} />
              Membership QR
            </button>
            {can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Customer
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={customers.length}
          icon={UserRound}
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={UserRound}
          tone="emerald"
        />
        <StatCard
          label="Points Outstanding"
          value={`${totalPoints.toLocaleString()} pts`}
          icon={Sparkles}
          tone="indigo"
          hint="Across all customers"
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
            placeholder="Search customers by name, phone, or email..."
            aria-label="Filter customers"
            className="h-full w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No customers yet"
          description="Record a sale with a customer phone number, or add a customer manually to start."
          action={
            can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Customer
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Customer</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Email</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Points</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          {isFetching && customers.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No customers match &ldquo;{filterText}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginated.map((customer, i) => (
                <div
                  key={customer.id}
                  className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                    {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                  </div>

                  {/* Name block opens the customer's detail page */}
                  <RowLink
                    href={`/dashboard/customers/${customer.id}`}
                    label={`View ${customer.name ?? "customer"}`}
                    className="col-span-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-admin-text transition-colors group-hover:text-admin-accent">
                        {customer.name ?? "Unnamed"}
                      </p>
                      <div className="flex items-center gap-2">
                        {customer.phone && (
                          <span className="truncate text-[11px] text-admin-text-muted">
                            {customer.phone}
                          </span>
                        )}
                        {!customer.isActive && (
                          <span className="inline-flex w-fit items-center rounded-full bg-admin-text-muted/15 px-2 py-0.5 text-[10px] font-bold text-admin-text-muted">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </RowLink>

                  <div className="col-span-3 min-w-0">
                    <p className="truncate text-sm text-admin-text">
                      {customer.email ?? "N/A"}
                    </p>
                  </div>

                  <div className="col-span-2 text-right">
                    <span className="text-sm font-bold text-admin-text">
                      {customer.pointsBalance.toLocaleString()}
                    </span>
                    <span className="ml-1 text-[11px] text-admin-text-muted">
                      pts
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {!can.edit && !can.delete && (
                      <span className="text-[11px] italic text-admin-text-muted">View only</span>
                    )}
                    <ActionMenu
                      label={`Actions for ${customer.name ?? "customer"}`}
                      items={[
                        {
                          key: "edit",
                          label: "Edit customer",
                          icon: Pencil,
                          onSelect: () => openEdit(customer),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete customer",
                          icon: Trash2,
                          onSelect: () => handleDelete(customer),
                          disabled: deleteCustomer.isPending,
                          destructive: true,
                          hidden: !can.delete,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="customers"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {formOpen && (
        <CustomerFormModal
          key={editing?.id ?? "new"}
          open
          customer={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      {qrOpen && (
        <MembershipQrModal
          open
          shopName={shopName}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}
