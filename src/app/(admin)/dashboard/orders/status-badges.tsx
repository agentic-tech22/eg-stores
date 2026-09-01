import { getNcmTone } from "@/lib/ncm/statusMapping";
import type { NcmTone } from "@/types/ncm.types";
import type {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from "@/types/order.types";
import { cn } from "@/utils/cn";

const toneClasses: Record<NcmTone, string> = {
  success: "bg-admin-success/12 text-admin-success",
  error: "bg-admin-danger/12 text-admin-danger",
  warning: "bg-admin-warning/15 text-admin-warning",
  info: "bg-admin-accent/12 text-admin-accent",
  pending: "bg-amber-500/12 text-amber-600",
  neutral: "bg-admin-card text-admin-text-muted",
};

const orderStatusTone: Record<OrderStatus, NcmTone> = {
  pending: "pending",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "error",
};

const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        toneClasses[orderStatusTone[status]],
      )}
    >
      {orderStatusLabel[status]}
    </span>
  );
}

/**
 * Tags how an order was paid. eSewa orders (online checkout from the website)
 * get a green "eSewa · Paid" tag; cash-on-delivery orders get a muted "COD" tag.
 */
export function PaymentBadge({
  method,
  status,
}: {
  method: OrderPaymentMethod;
  status: OrderPaymentStatus;
}) {
  if (method === "esewa") {
    const tone: NcmTone = status === "paid" ? "success" : "warning";
    const label =
      status === "paid"
        ? "eSewa · Paid"
        : status === "refunded"
          ? "eSewa · Refunded"
          : "eSewa · Unpaid";
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
          toneClasses[tone],
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        toneClasses.neutral,
      )}
    >
      COD
    </span>
  );
}

export function NcmStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-admin-text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-admin-text-muted/40" />
        Not shipped
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        toneClasses[getNcmTone(status)],
      )}
    >
      {status}
    </span>
  );
}
