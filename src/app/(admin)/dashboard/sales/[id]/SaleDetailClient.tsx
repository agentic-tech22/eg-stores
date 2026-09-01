"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Wallet } from "lucide-react";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { PermissionGate } from "@/components/auth/permission-context";
import { useSale } from "@/hooks/sales/use-sales";
import {
  useDeleteSale,
  useDeleteSalePayment,
} from "@/hooks/sales/use-sale-mutations";
import { notify } from "@/lib/toast";
import type { Product, ProductVariant } from "@/types/product.types";
import type { Invoice } from "@/types/invoice.types";
import {
  paymentMethodLabel,
  saleAmountDue,
  saleAmountPaid,
  saleAmountSplit,
  saleProfit,
  type Sale,
} from "@/types/sale.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { formatCurrency } from "@/utils/format-currency";
import { SaleFormModal } from "../SaleFormModal";
import { PaymentBadge, PaymentStatusBadge } from "../payment-badge";
import { GenerateInvoiceButton } from "./GenerateInvoiceButton";
import { RecordPaymentModal } from "./RecordPaymentModal";

interface SaleDetailClientProps {
  initialSale: Sale;
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  warehouses: Warehouse[];
  userDefaultWarehouseId?: string | null;
  availabilityByWarehouse: WarehouseAvailability;
  invoice: Invoice | null;
  currency: { code: string; locale: string };
  can: {
    edit: boolean;
    delete: boolean;
    viewInvoice: boolean;
    generateInvoice: boolean;
    /** May collect against an outstanding balance (same grant as recording a sale). */
    recordPayment: boolean;
  };
}

export function SaleDetailClient({
  initialSale,
  products,
  variantsByProduct,
  warehouses,
  userDefaultWarehouseId,
  availabilityByWarehouse,
  invoice,
  currency,
  can,
}: SaleDetailClientProps) {
  const { data: sale } = useSale(initialSale.id, initialSale);
  const router = useRouter();
  const confirm = useConfirm();
  const deleteSale = useDeleteSale();
  const deletePayment = useDeleteSalePayment();
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const money = (n: number) =>
    formatCurrency(n, currency.code, currency.locale);

  const items = sale.items ?? [];
  const extras = sale.extras ?? [];
  const payments = sale.payments ?? [];
  const paid = saleAmountPaid(sale);
  const due = saleAmountDue(sale);
  const profit = saleProfit(sale);
  // Product vs. extra-sale breakdown of this bill. Only worth showing at all
  // when the sale actually carries an extra line.
  const split = saleAmountSplit(sale);

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete sale",
      description:
        "Delete this sale and restore the stock it deducted. This cannot be undone.",
      confirmLabel: "Delete sale",
      destructive: true,
    });
    if (!ok) return;
    deleteSale.mutate(sale.id, {
      onSuccess: () => {
        notify.success("Sale deleted.");
        router.push("/dashboard/sales");
      },
    });
  }

  async function handleDeletePayment(paymentId: string) {
    const ok = await confirm({
      title: "Remove payment",
      description:
        "Remove this collection from the sale's ledger? The amount due is recalculated, and the sale may go back to unpaid.",
      confirmLabel: "Remove payment",
      destructive: true,
    });
    if (!ok) return;
    deletePayment.mutate(paymentId, {
      onSuccess: () => notify.success("Payment removed."),
    });
  }

  return (
    <div>
      <Link
        href="/dashboard/sales"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-admin-text-muted transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sales
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-admin-text">
              Sale #{sale.saleNumber}
            </h1>
            <PaymentBadge method={sale.paymentMethod} />
            <PaymentStatusBadge status={sale.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-admin-text-muted">
            {sale.saleDate.slice(0, 10)}
            {sale.customerName && ` · ${sale.customerName}`}
            {sale.customerPhone && ` · ${sale.customerPhone}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(can.viewInvoice || can.generateInvoice) && (
            <GenerateInvoiceButton
              saleId={sale.id}
              invoice={invoice}
              can={{
                viewInvoice: can.viewInvoice,
                generateInvoice: can.generateInvoice,
              }}
            />
          )}
          {can.edit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {can.delete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleteSale.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-danger/30 px-4 py-2 text-sm font-bold text-admin-danger transition-colors hover:bg-admin-danger/10 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <p className="col-span-5 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Product</p>
          <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Qty</p>
          <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Unit Price</p>
          <p className="col-span-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Line Total</p>
        </div>
        <div className="divide-y divide-admin-border">
          {items.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-admin-text-muted">
              No catalog products on this sale.
            </p>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-5">
                  <p className="text-sm font-semibold text-admin-text">
                    {it.productTitle}
                  </p>
                  {it.variantLabel && (
                    <p className="text-[11px] text-admin-text-muted">
                      {it.variantLabel}
                    </p>
                  )}
                </div>
                <div className="col-span-2 text-sm text-admin-text">
                  ×{it.quantity}
                </div>
                <div className="col-span-2 text-sm text-admin-text">
                  {money(it.unitPrice)}
                </div>
                <div className="col-span-3 text-right text-sm font-bold text-admin-text">
                  {money(it.lineTotal)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Extra sales: charged on the same bill, kept out of product figures. */}
        {extras.length > 0 && (
          <>
            <div className="border-y border-admin-border bg-admin-card/40 px-5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
                Extra sales · not stocked, excluded from product profit
              </p>
            </div>
            <div className="divide-y divide-admin-border">
              {extras.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-5">
                    <p className="text-sm font-semibold text-admin-text">
                      {it.title}
                    </p>
                  </div>
                  <div className="col-span-2 text-sm text-admin-text">
                    ×{it.quantity}
                  </div>
                  <div className="col-span-2 text-sm text-admin-text">
                    {money(it.unitPrice)}
                  </div>
                  <div className="col-span-3 text-right text-sm font-bold text-admin-text">
                    {money(it.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Totals */}
        <div className="border-t border-admin-border px-5 py-4">
          <div className="ml-auto max-w-xs space-y-1.5">
            {extras.length > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-admin-text-muted">
                  <span>Products</span>
                  <span className="font-semibold text-admin-text">
                    {money(split.itemsSubtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-admin-text-muted">
                  <span>Extra sales</span>
                  <span className="font-semibold text-admin-text">
                    {money(split.extrasSubtotal)}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-sm text-admin-text-muted">
              <span>Subtotal</span>
              <span className="font-semibold text-admin-text">
                {money(sale.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-admin-text-muted">
              <span>Discount</span>
              <span className="font-semibold text-admin-text">
                −{money(sale.discountAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-admin-border pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-admin-text-muted">
                Total
              </span>
              <span className="text-lg font-extrabold text-admin-text">
                {money(sale.total)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-admin-text-muted">
              <span>Paid</span>
              <span className="font-semibold text-admin-text">
                {money(paid)}
              </span>
            </div>
            {due > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-amber-600">Due</span>
                <span className="text-base font-extrabold text-amber-600">
                  {money(due)}
                </span>
              </div>
            )}
            <PermissionGate permission="finances.view">
              <div className="flex items-center justify-between text-sm text-admin-text-muted">
                <span>{extras.length > 0 ? "Product profit" : "Profit"}</span>
                <span className="font-semibold text-emerald-600">
                  {money(profit)}
                </span>
              </div>
              {extras.length > 0 && (
                <p className="text-right text-[11px] text-admin-text-muted">
                  Excludes {money(split.extrasRevenue)} of extra sales, which
                  carry no cost.
                </p>
              )}
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Payment ledger: what was collected, when, and by whom. */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
              Payments
            </p>
            <p className="mt-0.5 text-sm text-admin-text-muted">
              {due > 0 ? (
                <>
                  <span className="font-bold text-amber-600">{money(due)}</span>{" "}
                  still due
                  {sale.customerName && ` from ${sale.customerName}`}
                  {sale.customerPhone && ` · ${sale.customerPhone}`}
                </>
              ) : (
                "Fully settled."
              )}
            </p>
          </div>
          {can.recordPayment && due > 0 && (
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
            >
              <Wallet className="h-4 w-4" />
              Record payment
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-admin-text-muted">
            Nothing collected yet on this sale.
          </p>
        ) : (
          <div className="divide-y divide-admin-border">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-admin-text">
                    {money(payment.amount)}
                    <span className="ml-2 text-[11px] font-semibold text-admin-text-muted">
                      {paymentMethodLabel(payment.paymentMethod)}
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-admin-text-muted">
                    {payment.paidOn.slice(0, 10)}
                    {payment.receivedByEmail
                      ? ` · received by ${payment.receivedByEmail}`
                      : ""}
                  </p>
                  {payment.note && (
                    <p className="truncate text-[11px] text-admin-text-muted">
                      {payment.note}
                    </p>
                  )}
                </div>
                {can.edit && (
                  <button
                    type="button"
                    onClick={() => void handleDeletePayment(payment.id)}
                    disabled={deletePayment.isPending}
                    aria-label={`Remove the ${money(payment.amount)} payment`}
                    title="Remove this payment"
                    className="cursor-pointer rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {sale.notes && (
        <div className="mt-4 rounded-2xl border border-admin-border bg-admin-surface p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
            Notes
          </p>
          <p className="mt-1.5 text-sm text-admin-text">{sale.notes}</p>
        </div>
      )}

      <RecordPaymentModal
        open={paymentOpen}
        saleId={sale.id}
        due={due}
        defaultMethod={sale.paymentMethod}
        currency={currency}
        onClose={() => setPaymentOpen(false)}
      />

      {editOpen && (
        <SaleFormModal
          open
          onClose={() => setEditOpen(false)}
          products={products}
          variantsByProduct={variantsByProduct}
          warehouses={warehouses}
          userDefaultWarehouseId={userDefaultWarehouseId}
          availabilityByWarehouse={availabilityByWarehouse}
          currency={currency}
          sale={sale}
        />
      )}
    </div>
  );
}
