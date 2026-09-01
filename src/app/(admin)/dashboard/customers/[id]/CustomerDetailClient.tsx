"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  IdCard,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useDeleteLoyaltyTransaction,
  useLoyaltyTransactions,
} from "@/hooks/customers/use-customers";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import { EmptyState, Pagination, StatCard } from "@/components/molecules/admin";
import { notify } from "@/lib/toast";
import { computeLoyaltyBalance } from "@/services/customer-engine";
import { fetchCitizenshipPhotoUrl } from "@/services/customer.service";
import {
  LOYALTY_TYPE_LABELS,
  type Customer,
  type CustomerSale,
  type LoyaltyTransaction,
} from "@/types/customer.types";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";
import { LoyaltyTransactionModal } from "../LoyaltyTransactionModal";

interface CustomerDetailClientProps {
  customer: Customer;
  initialTransactions: LoyaltyTransaction[];
  sales: CustomerSale[];
  currency: { code: string; locale: string };
  can: { edit: boolean };
}

const ITEMS_PER_PAGE = 8;

const typeTone: Record<string, string> = {
  earn: "bg-admin-success/12 text-admin-success",
  redeem: "bg-admin-danger/12 text-admin-danger",
  adjust: "bg-amber-500/15 text-amber-600",
};

export function CustomerDetailClient({
  customer,
  initialTransactions,
  sales,
  currency,
  can,
}: CustomerDetailClientProps) {
  const { data: transactions } = useLoyaltyTransactions(
    customer.id,
    initialTransactions,
  );
  const deleteTxn = useDeleteLoyaltyTransaction();
  const confirm = useConfirm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyTransaction | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [photoPending, setPhotoPending] = useState(false);

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  const pointsBalance = computeLoyaltyBalance(transactions);
  const totalSpent = sales.reduce((sum, s) => sum + s.total, 0);

  // Running balance after each ledger row, computed oldest → newest.
  const balanceAfter = useMemo(() => {
    const ordered = [...transactions].reverse();
    const map = new Map<string, number>();
    let running = 0;
    for (const t of ordered) {
      running += t.points;
      map.set(t.id, running);
    }
    return map;
  }, [transactions]);

  // Both tables page client-side; the running balance above stays computed over
  // the full ledger so per-row balances are unaffected by the current page.
  const ledgerTotalPages = Math.max(
    1,
    Math.ceil(transactions.length / ITEMS_PER_PAGE),
  );
  const ledgerSafePage = Math.min(ledgerPage, ledgerTotalPages);
  const pagedTransactions = transactions.slice(
    (ledgerSafePage - 1) * ITEMS_PER_PAGE,
    ledgerSafePage * ITEMS_PER_PAGE,
  );

  const salesTotalPages = Math.max(
    1,
    Math.ceil(sales.length / ITEMS_PER_PAGE),
  );
  const salesSafePage = Math.min(salesPage, salesTotalPages);
  const pagedSales = sales.slice(
    (salesSafePage - 1) * ITEMS_PER_PAGE,
    salesSafePage * ITEMS_PER_PAGE,
  );

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(txn: LoyaltyTransaction) {
    setEditing(txn);
    setModalOpen(true);
  }

  async function handleDelete(txn: LoyaltyTransaction) {
    const ok = await confirm({
      title: "Delete loyalty entry",
      description:
        "This removes the ledger entry and adjusts the points balance. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteTxn.mutate(txn.id, {
      onSuccess: () => notify.success("Entry deleted."),
    });
  }

  /**
   * The photo lives in a private bucket, so it is opened through a signed link
   * minted on click — always fresh, and never rendered into the page as a URL
   * that outlives the session. The tab is opened first, synchronously, so the
   * browser attributes it to the click instead of blocking it as a popup.
   */
  async function openCitizenshipPhoto() {
    const tab = window.open("", "_blank", "noopener,noreferrer");
    setPhotoPending(true);
    try {
      const url = await fetchCitizenshipPhotoUrl(customer.id);
      if (!url) {
        tab?.close();
        notify.error("That photo is no longer available.");
        return;
      }
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch {
      tab?.close();
      notify.error("Could not open the photo.");
    } finally {
      setPhotoPending(false);
    }
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Phone", value: customer.phone },
    { label: "Email", value: customer.email },
    { label: "Address", value: customer.address },
    { label: "Date of birth", value: customer.dob },
    { label: "Citizenship number", value: customer.citizenshipNumber },
  ];

  return (
    <div>
      <Link
        href="/dashboard/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-admin-text-muted transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-admin-text">
              {customer.name ?? "Unnamed customer"}
            </h1>
            {!customer.isActive && (
              <span className="rounded-full bg-admin-text-muted/15 px-2.5 py-1 text-[11px] font-bold text-admin-text-muted">
                Inactive
              </span>
            )}
          </div>
          {customer.notes && (
            <p className="mt-2 max-w-2xl text-sm text-admin-text-muted">
              {customer.notes}
            </p>
          )}
        </div>

        {can.edit && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Loyalty Entry
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Points Balance"
          value={`${pointsBalance.toLocaleString()} pts`}
          icon={Sparkles}
          tone="indigo"
          hint="Current loyalty balance"
        />
        <StatCard
          label="Total Spent"
          value={money(totalSpent)}
          icon={ShoppingBag}
          tone="emerald"
          hint="Across all linked sales"
        />
        <StatCard
          label="Sales"
          value={sales.length}
          icon={Receipt}
          hint="Point-of-sale transactions"
        />
      </div>

      <div className="mb-6">
        <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
            Details
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {details.map((d) => (
              <div key={d.label} className="min-w-0">
                <dt className="text-[11px] text-admin-text-muted">{d.label}</dt>
                <dd className="truncate text-sm font-semibold text-admin-text">
                  {d.value ?? "N/A"}
                </dd>
              </div>
            ))}
          </dl>

          {customer.citizenshipPhotoPath && (
            <div className="mt-4 border-t border-admin-border pt-4">
              <p className="text-[11px] text-admin-text-muted">
                Citizenship photo
              </p>
              <button
                type="button"
                onClick={openCitizenshipPhoto}
                disabled={photoPending}
                className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-admin-accent transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                <IdCard className="h-4 w-4" />
                {photoPending ? "Opening..." : "View photo"}
              </button>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold text-admin-text">Loyalty ledger</h2>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No loyalty entries yet"
          description="Points earned from sales appear here, along with any manual entries you record."
        />
      ) : (
        <div className="mb-8 overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
            <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Entry</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Points</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Balance</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          <div className="divide-y divide-admin-border">
            {pagedTransactions.map((txn) => (
              <div
                key={txn.id}
                className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-2 text-sm text-admin-text">
                  {txn.txnDate}
                </div>

                <div className="col-span-4 min-w-0">
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                      typeTone[txn.type],
                    )}
                  >
                    {LOYALTY_TYPE_LABELS[txn.type]}
                  </span>
                  <p className="mt-0.5 truncate text-[11px] text-admin-text-muted">
                    {txn.note ?? (txn.saleId ? "From sale" : "Manual entry")}
                  </p>
                </div>

                <div className="col-span-2 text-right">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      txn.points >= 0
                        ? "text-admin-success"
                        : "text-admin-danger",
                    )}
                  >
                    {txn.points >= 0 ? "+" : "−"}
                    {Math.abs(txn.points).toLocaleString()}
                  </span>
                </div>

                <div className="col-span-2 text-right text-sm font-semibold text-admin-text">
                  {(balanceAfter.get(txn.id) ?? 0).toLocaleString()}
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1">
                  {can.edit ? (
                    <ActionMenu
                      label="Actions for this entry"
                      items={[
                        {
                          key: "edit",
                          label: "Edit entry",
                          icon: Pencil,
                          onSelect: () => openEdit(txn),
                        },
                        {
                          key: "delete",
                          label: "Delete entry",
                          icon: Trash2,
                          onSelect: () => handleDelete(txn),
                          disabled: deleteTxn.isPending,
                          destructive: true,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  ) : (
                    <span className="text-[11px] italic text-admin-text-muted">
                      View only
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={ledgerSafePage}
            totalPages={ledgerTotalPages}
            totalItems={transactions.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="entries"
            onPageChange={setLedgerPage}
          />
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold text-admin-text">Purchase history</h2>

      {sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No purchases yet"
          description="Sales recorded for this customer will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
            <p className="col-span-5 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Sale</p>
            <p className="col-span-4 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Total</p>
          </div>

          <div className="divide-y divide-admin-border">
            {pagedSales.map((sale) => (
              <div
                key={sale.id}
                className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-3 text-sm text-admin-text">
                  {sale.saleDate}
                </div>
                <div className="col-span-5 min-w-0">
                  <Link
                    href={`/dashboard/sales/${sale.id}`}
                    className="text-sm font-bold text-admin-text hover:text-admin-accent"
                  >
                    Sale #{sale.saleNumber}
                  </Link>
                </div>
                <div className="col-span-4 text-right text-sm font-bold text-admin-text">
                  {money(sale.total)}
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={salesSafePage}
            totalPages={salesTotalPages}
            totalItems={sales.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="sales"
            onPageChange={setSalesPage}
          />
        </div>
      )}

      {modalOpen && (
        <LoyaltyTransactionModal
          key={editing?.id ?? "new"}
          open
          customerId={customer.id}
          transaction={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
