"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  useVendorTransactions,
  useDeleteVendorTransaction,
  useSetVendorBillStatus,
} from "@/hooks/vendors/use-vendors";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import { EmptyState, StatCard } from "@/components/molecules/admin";
import { notify } from "@/lib/toast";
import {
  balanceDelta,
  computeVendorBalance,
  describePayable,
} from "@/services/vendor-engine";
import {
  VENDOR_BILL_STATUS_LABELS,
  vendorPaymentMethodLabel,
  type Vendor,
  type VendorBillStatus,
  type VendorTransaction,
  type VendorTransactionType,
} from "@/types/vendor.types";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";
import { VendorTransactionModal } from "../VendorTransactionModal";

interface VendorDetailClientProps {
  vendor: Vendor;
  initialTransactions: VendorTransaction[];
  currency: { code: string; locale: string };
  can: { edit: boolean };
}

const statusTone: Record<string, string> = {
  paid: "bg-admin-success/12 text-admin-success",
  unpaid: "bg-admin-danger/12 text-admin-danger",
};

/** Today in local time as YYYY-MM-DD, matching how ledger dates are entered. */
function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function VendorDetailClient({
  vendor,
  initialTransactions,
  currency,
  can,
}: VendorDetailClientProps) {
  const { data: transactions } = useVendorTransactions(
    vendor.id,
    initialTransactions,
  );
  const deleteTxn = useDeleteVendorTransaction();
  const setBillStatus = useSetVendorBillStatus();
  const confirm = useConfirm();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<VendorTransactionType>("bill");
  const [editing, setEditing] = useState<VendorTransaction | null>(null);

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  const outstanding = computeVendorBalance(vendor.openingBalance, transactions);
  const payable = describePayable(outstanding);
  const totalPurchased = transactions
    .filter((t) => t.type === "bill")
    .reduce((sum, t) => sum + t.amount, 0);

  // Running payable after each row, computed oldest → newest. Bills already
  // settled at source ("paid") leave the balance unchanged.
  const balanceAfter = useMemo(() => {
    const ordered = [...transactions].reverse(); // oldest first
    const map = new Map<string, number>();
    let running = vendor.openingBalance;
    for (const t of ordered) {
      running += balanceDelta(t);
      map.set(t.id, running);
    }
    return map;
  }, [transactions, vendor.openingBalance]);

  function openCreate(type: VendorTransactionType) {
    setModalType(type);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(txn: VendorTransaction) {
    setModalType(txn.type);
    setEditing(txn);
    setModalOpen(true);
  }

  function handleStatusChange(txn: VendorTransaction, status: VendorBillStatus) {
    setBillStatus.mutate(
      // Settled today; edit the bill to record a different settlement date.
      { id: txn.id, status, paidAt: status === "paid" ? todayIso() : null },
      {
        onSuccess: () =>
          notify.success(
            status === "paid"
              ? "Bill marked paid — it no longer counts toward the payable."
              : "Bill marked unpaid — it counts toward the payable again.",
          ),
      },
    );
  }

  async function handleDelete(txn: VendorTransaction) {
    const ok = await confirm({
      title: `Delete ${txn.type}`,
      description:
        "This removes the ledger entry and any attached files. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteTxn.mutate(txn.id, {
      onSuccess: () => notify.success("Entry deleted."),
    });
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Contact", value: vendor.contactPerson },
    { label: "Phone", value: vendor.phone },
    { label: "Email", value: vendor.email },
    { label: "Address", value: vendor.address },
    { label: "PAN", value: vendor.panNumber },
    { label: "VAT", value: vendor.vatNumber },
  ];

  return (
    <div>
      <Link
        href="/dashboard/vendors"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-admin-text-muted transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to vendors
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-admin-text">
              {vendor.name}
            </h1>
            {vendor.code && (
              <span className="rounded-lg bg-admin-card px-2.5 py-1 text-xs font-bold text-admin-text-muted">
                {vendor.code}
              </span>
            )}
            {!vendor.isActive && (
              <span className="rounded-full bg-admin-text-muted/15 px-2.5 py-1 text-[11px] font-bold text-admin-text-muted">
                Inactive
              </span>
            )}
          </div>
          {vendor.notes && (
            <p className="mt-2 max-w-2xl text-sm text-admin-text-muted">
              {vendor.notes}
            </p>
          )}
        </div>

        {can.edit && (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => openCreate("payment")}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-admin-border px-4 py-2.5 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card sm:flex-none"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Payment
            </button>
            <button
              type="button"
              onClick={() => openCreate("bill")}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover sm:flex-none"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Bill
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Purchased"
          value={money(totalPurchased)}
          icon={ShoppingBag}
          tone="indigo"
          hint="Sum of all bills, all time"
        />
        <StatCard
          label={payable.isCredit ? "Advance / Credit" : "Outstanding Payable"}
          value={money(payable.amount)}
          icon={Wallet}
          tone={payable.isCredit ? "emerald" : outstanding > 0 ? "amber" : "emerald"}
          hint={
            payable.isCredit
              ? "Prepaid, the vendor owes you"
              : "What you still owe"
          }
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
            <div className="min-w-0">
              <dt className="text-[11px] text-admin-text-muted">
                Opening balance
              </dt>
              <dd className="truncate text-sm font-semibold text-admin-text">
                {money(vendor.openingBalance)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold text-admin-text">Ledger</h2>

      {transactions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No transactions yet"
          description="Record a bill or payment to start this vendor's ledger."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Entry</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Paid at</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Amount</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Balance</p>
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Files</p>
            <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          <div className="divide-y divide-admin-border">
            {transactions.map((txn) => {
              const isBill = txn.type === "bill";
              // A settled bill never moved the payable, so it reads as neutral
              // rather than as money owed.
              const amountColor = !isBill
                ? "text-admin-success"
                : txn.status === "paid"
                  ? "text-admin-text-muted"
                  : "text-admin-danger";
              const meta = isBill
                ? txn.billNumber
                  ? `Bill #${txn.billNumber}`
                  : "Bill"
                : [
                    txn.paymentMethod
                      ? vendorPaymentMethodLabel(txn.paymentMethod)
                      : null,
                    txn.reference ? `Ref ${txn.reference}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Payment";

              const typeBadges = (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                      isBill
                        ? "bg-admin-danger/12 text-admin-danger"
                        : "bg-admin-success/12 text-admin-success",
                    )}
                  >
                    {isBill ? "Bill" : "Payment"}
                  </span>
                  {isBill && txn.status && (
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                        statusTone[txn.status],
                      )}
                    >
                      {VENDOR_BILL_STATUS_LABELS[txn.status]}
                    </span>
                  )}
                </div>
              );

              const attachmentIcons =
                txn.attachments.length > 0 ? (
                  txn.attachments.slice(0, 3).map((att) => (
                    <a
                      key={att.url}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={att.name}
                      className="text-admin-text-muted transition-colors hover:text-admin-accent"
                    >
                      {att.type.startsWith("image/") ? (
                        <ImageIcon className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </a>
                  ))
                ) : (
                  <span className="text-[11px] text-admin-text-muted">N/A</span>
                );

              const actions = can.edit ? (
                <ActionMenu
                  label="Actions for this entry"
                  items={[
                    {
                      key: "mark-paid",
                      label: "Mark as paid",
                      icon: CheckCircle2,
                      onSelect: () => handleStatusChange(txn, "paid"),
                      disabled: setBillStatus.isPending,
                      hidden: !isBill || txn.status === "paid",
                    },
                    {
                      key: "mark-unpaid",
                      label: "Mark as unpaid",
                      icon: RotateCcw,
                      onSelect: () => handleStatusChange(txn, "unpaid"),
                      disabled: setBillStatus.isPending,
                      hidden: !isBill || txn.status !== "paid",
                    },
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
              );

              return (
                <div
                  key={txn.id}
                  className="px-5 py-3.5 transition-colors hover:bg-admin-card/30"
                >
                  {/* Mobile: stacked card with labels */}
                  <div className="sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {typeBadges}
                        <p className="mt-1 truncate text-[11px] text-admin-text-muted">
                          {txn.txnDate} · {meta}
                        </p>
                        {txn.paidAt && (
                          <p className="truncate text-[11px] text-admin-text-muted">
                            Paid at {txn.paidAt}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">{actions}</div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-admin-border pt-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-admin-text-muted">
                          Amount
                        </p>
                        <p className={cn("text-sm font-bold", amountColor)}>
                          {isBill ? "+" : "−"}
                          {money(txn.amount)}
                        </p>
                        {isBill && txn.taxAmount > 0 && (
                          <p className="text-[10px] text-admin-text-muted">
                            incl. {money(txn.taxAmount)} VAT
                          </p>
                        )}
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-admin-text-muted">
                          Balance
                        </p>
                        <p className="text-sm font-semibold text-admin-text">
                          {money(balanceAfter.get(txn.id) ?? 0)}
                        </p>
                      </div>
                    </div>
                    {txn.attachments.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-admin-text-muted">
                          Files
                        </span>
                        <span className="flex items-center gap-1.5">
                          {attachmentIcons}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Desktop: 12-col table row */}
                  <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                    <div className="col-span-2 text-sm text-admin-text">
                      {txn.txnDate}
                    </div>
                    <div className="col-span-2 min-w-0">
                      {typeBadges}
                      <p className="mt-0.5 truncate text-[11px] text-admin-text-muted">
                        {meta}
                      </p>
                    </div>
                    <div className="col-span-2 text-sm text-admin-text">
                      {txn.paidAt ?? (
                        <span className="text-[11px] text-admin-text-muted">
                          N/A
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={cn("text-sm font-bold", amountColor)}>
                        {isBill ? "+" : "−"}
                        {money(txn.amount)}
                      </span>
                      {isBill && txn.taxAmount > 0 && (
                        <p className="text-[10px] text-admin-text-muted">
                          incl. {money(txn.taxAmount)} VAT
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-sm font-semibold text-admin-text">
                      {money(balanceAfter.get(txn.id) ?? 0)}
                    </div>
                    <div className="col-span-1 flex items-center gap-1.5">
                      {attachmentIcons}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      {actions}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalOpen && (
        <VendorTransactionModal
          key={editing?.id ?? `new-${modalType}`}
          open
          vendorId={vendor.id}
          type={modalType}
          transaction={editing}
          currency={currency}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
