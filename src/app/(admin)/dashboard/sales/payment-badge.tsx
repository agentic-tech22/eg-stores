import {
  PAYMENT_STATUS_LABELS,
  paymentMethodLabel,
  saleChannelLabel,
  type PaymentMethod,
  type PaymentStatus,
  type SaleChannel,
} from "@/types/sale.types";
import { cn } from "@/utils/cn";

// Credit/due is highlighted amber (money still owed); everything else is neutral.
const toneClasses: Record<PaymentMethod, string> = {
  cash: "bg-admin-success/12 text-admin-success",
  fonepay: "bg-admin-accent/12 text-admin-accent",
  esewa: "bg-admin-accent/12 text-admin-accent",
  khalti: "bg-admin-accent/12 text-admin-accent",
  ime_pay: "bg-admin-accent/12 text-admin-accent",
  bank: "bg-admin-card text-admin-text-muted",
  credit: "bg-amber-500/12 text-amber-600",
};

export function PaymentBadge({ method }: { method: PaymentMethod }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        toneClasses[method],
      )}
    >
      {paymentMethodLabel(method)}
    </span>
  );
}

const statusTone: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/12 text-amber-600",
  partial: "bg-amber-500/12 text-amber-600",
  paid: "bg-admin-success/12 text-admin-success",
  failed: "bg-admin-danger/12 text-admin-danger",
};

/**
 * Small settlement-status pill. Shown only for sales that aren't the trivial
 * `paid` case (unpaid or part-paid sales carrying a due, and Fonepay sales
 * awaiting or failing a scan) so the list isn't cluttered with a "Paid" tag on
 * every cash sale.
 */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "paid") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        statusTone[status],
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

// Online is accented so it stands out from the counter default at a glance.
const channelTone: Record<SaleChannel, string> = {
  shop: "bg-admin-card text-admin-text-muted",
  online: "bg-admin-accent/12 text-admin-accent",
};

/**
 * How the sale was made. Unlike `PaymentStatusBadge` this renders for both
 * values: telling shop and online apart is the whole point of the field.
 */
export function SaleChannelBadge({ channel }: { channel: SaleChannel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        channelTone[channel],
      )}
    >
      {saleChannelLabel(channel)}
    </span>
  );
}
