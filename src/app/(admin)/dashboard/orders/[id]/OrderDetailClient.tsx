"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Receipt, Trash2 } from "lucide-react";
import { Select, TextInput } from "@/components/molecules/form";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { useOrder } from "@/hooks/orders/use-orders";
import {
  useCancelOrder,
  useConvertOrderToSale,
  useDeleteOrder,
  useUpdateOrderDiscount,
  useUpdateOrderStatus,
} from "@/hooks/orders/use-order-mutations";
import { notify } from "@/lib/toast";
import { clampDiscount } from "@/lib/pos/sale-payment";
import type { NcmDeliveryType } from "@/types/ncm.types";
import { orderDeleteBlocker } from "@/types/order.types";
import type { Order, OrderStatus } from "@/types/order.types";
import { formatCurrency } from "@/utils/format-currency";
import { NcmShipmentCard } from "../NcmShipmentCard";
import { OrderStatusBadge, PaymentBadge } from "../status-badges";

const MANUAL_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

interface OrderDetailClientProps {
  initialOrder: Order;
  ncmDefaults: {
    fromBranch: string | null;
    deliveryType: NcmDeliveryType;
    codCharge: number;
  };
  currency: { code: string; locale: string };
  can: {
    edit: boolean;
    cancel: boolean;
    delete: boolean;
    ship: boolean;
    manage: boolean;
    convert: boolean;
  };
}

export function OrderDetailClient({
  initialOrder,
  ncmDefaults,
  currency,
  can,
}: OrderDetailClientProps) {
  const { data: order } = useOrder(initialOrder.id, initialOrder);
  const router = useRouter();
  const confirm = useConfirm();
  const updateStatus = useUpdateOrderStatus();
  const cancelOrder = useCancelOrder();
  const convertToSale = useConvertOrderToSale();
  const updateDiscount = useUpdateOrderDiscount();
  const deleteOrder = useDeleteOrder();

  // Inline discount editing. `null` means the editor is closed.
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  function handleStatusChange(status: OrderStatus) {
    if (status === order.status) return;
    updateStatus.mutate(
      { id: order.id, status },
      { onSuccess: () => notify.success("Order status updated.") },
    );
  }

  async function handleCancel() {
    const ok = await confirm({
      title: "Cancel order",
      description:
        "Cancel this order and release any reserved stock. This cannot be undone.",
      confirmLabel: "Cancel order",
      destructive: true,
    });
    if (!ok) return;
    cancelOrder.mutate(order.id, {
      onSuccess: () => notify.success("Order cancelled."),
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete order",
      description:
        "Permanently remove this cancelled order and its items. Its stock was already released, so inventory is unaffected. This cannot be undone.",
      confirmLabel: "Delete order",
      destructive: true,
    });
    if (!ok) return;
    deleteOrder.mutate(order.id, {
      onSuccess: () => {
        notify.success("Order deleted.");
        router.push("/dashboard/orders");
      },
    });
  }

  async function handleConvert() {
    const ok = await confirm({
      title: "Convert to sale",
      description:
        "Create a sale from this delivered order so its revenue is counted. Stock is not touched (it was already deducted on delivery).",
      confirmLabel: "Convert to sale",
    });
    if (!ok) return;
    convertToSale.mutate(order.id, {
      onSuccess: () => notify.success("Order converted to a sale."),
    });
  }

  const canConvert =
    can.convert && order.status === "delivered" && !order.convertedSale;

  // The same predicate the server enforces, so the button appears only when the
  // delete would actually succeed.
  const canDelete = can.delete && orderDeleteBlocker(order) === null;

  // Changing the money after the courier has been told what to collect would
  // put the two out of step, so editing stops at dispatch.
  const canEditDiscount =
    can.edit && (order.status === "pending" || order.status === "processing");

  function saveDiscount() {
    const amount = clampDiscount(discountDraft, order.subtotal);
    updateDiscount.mutate(
      { id: order.id, amount },
      {
        onSuccess: () => {
          notify.success("Discount updated.");
          setDiscountDraft(null);
        },
      },
    );
  }

  return (
    <div>
      <Link
        href="/dashboard/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-admin-text-muted transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-admin-text">
              Order #{order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} />
            <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-admin-text-muted">
            {new Date(order.createdAt).toLocaleString()} ·{" "}
            {order.source === "storefront" ? "Storefront" : "Admin"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can.edit && (
            <Select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={updateStatus.isPending}
              className="w-44"
            >
              {MANUAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          )}
          {order.convertedSale ? (
            <Link
              href={`/dashboard/sales/${order.convertedSale.id}`}
              className="flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card"
            >
              <Receipt className="h-4 w-4" /> Sale #{order.convertedSale.saleNumber}
            </Link>
          ) : (
            canConvert && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={convertToSale.isPending}
                className="flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card disabled:opacity-40"
              >
                <Receipt className="h-4 w-4" /> Convert to sale
              </button>
            )
          )}
          {can.cancel && order.status !== "cancelled" && order.status !== "delivered" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelOrder.isPending}
              className="flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-danger transition-colors hover:bg-admin-danger/10 disabled:opacity-40"
            >
              <Ban className="h-4 w-4" /> Cancel
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleteOrder.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-danger/30 px-4 py-2 text-sm font-bold text-admin-danger transition-colors hover:bg-admin-danger/10 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: customer + items */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
            <h2 className="mb-3 text-sm font-bold text-admin-text">Customer</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-admin-text-muted">Name</dt>
                <dd className="font-semibold text-admin-text">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-admin-text-muted">Phone</dt>
                <dd className="font-semibold text-admin-text">
                  {order.customerPhone}
                  {order.customerPhone2 ? ` / ${order.customerPhone2}` : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-admin-text-muted">Address</dt>
                <dd className="font-semibold text-admin-text">{order.customerAddress}</dd>
              </div>
              {order.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-admin-text-muted">Notes</dt>
                  <dd className="text-admin-text">{order.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
            <div className="border-b border-admin-border px-5 py-3">
              <h2 className="text-sm font-bold text-admin-text">Items</h2>
            </div>
            <div className="divide-y divide-admin-border">
              {(order.items ?? [])
                // Hide combo component lines; their combo header line is shown
                // instead, with the components listed beneath it.
                .filter((item) => !(item.comboId && item.productId))
                .map((item) => {
                  const components =
                    item.comboId && !item.productId
                      ? (order.items ?? []).filter(
                          (c) => c.comboId === item.comboId && c.productId,
                        )
                      : [];
                  return (
                    <div key={item.id} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-admin-text">
                            {item.productTitle}
                            {item.variantLabel && (
                              <span className="ml-1.5 text-admin-text-muted">
                                ({item.variantLabel})
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-admin-text-muted">
                            {item.quantity} × {money(item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-admin-text">
                          {money(item.lineTotal)}
                        </p>
                      </div>
                      {components.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-3 text-[11px] text-admin-text-muted">
                          {components.map((c) => (
                            <li key={c.id}>
                              {c.quantity} × {c.productTitle}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
            </div>
            <div className="space-y-1 border-t border-admin-border bg-admin-card/40 px-5 py-4 text-sm">
              <div className="flex justify-between text-admin-text-muted">
                <span>Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-admin-text-muted">
                <span>Discount</span>
                {discountDraft === null ? (
                  <span className="flex items-center gap-2">
                    <span>
                      {order.discountAmount > 0
                        ? `−${money(order.discountAmount)}`
                        : money(0)}
                    </span>
                    {canEditDiscount && (
                      <button
                        type="button"
                        onClick={() =>
                          setDiscountDraft(String(order.discountAmount))
                        }
                        className="cursor-pointer text-[11px] font-bold text-admin-accent hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <TextInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountDraft}
                      onChange={(e) => setDiscountDraft(e.target.value)}
                      className="w-24"
                      aria-label="Discount amount"
                    />
                    <button
                      type="button"
                      onClick={saveDiscount}
                      disabled={updateDiscount.isPending}
                      className="cursor-pointer text-[11px] font-bold text-admin-accent hover:underline disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountDraft(null)}
                      className="cursor-pointer text-[11px] font-bold text-admin-text-muted hover:underline"
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
              <div className="flex justify-between text-base font-extrabold text-admin-text">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
              {/* What the courier collects on delivery. Recorded for the
                  shipment; deliberately not part of the total above. */}
              <div className="flex justify-between pt-1 text-admin-text-muted">
                <span>COD to collect</span>
                <span>{money(order.codCharge)}</span>
              </div>
              <div className="flex justify-between pt-1 text-admin-text-muted">
                <span>Payment</span>
                <span className="font-semibold text-admin-text">
                  {order.paymentMethod === "esewa"
                    ? `eSewa (${order.paymentStatus})`
                    : "Cash on delivery"}
                </span>
              </div>
              {order.esewaTransactionCode && (
                <div className="flex justify-between text-admin-text-muted">
                  <span>eSewa ref</span>
                  <span className="font-mono text-[12px] text-admin-text">
                    {order.esewaTransactionCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: NCM shipment */}
        <div className="lg:col-span-1">
          <NcmShipmentCard
            order={order}
            defaults={ncmDefaults}
            can={{ ship: can.ship, manage: can.manage, edit: can.edit }}
          />
        </div>
      </div>
    </div>
  );
}
