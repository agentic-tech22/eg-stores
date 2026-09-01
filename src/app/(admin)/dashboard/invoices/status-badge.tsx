import { invoiceStatusLabel, type InvoiceStatus } from "@/types/invoice.types";
import { cn } from "@/utils/cn";

const toneClasses: Record<InvoiceStatus, string> = {
  issued: "bg-amber-500/12 text-amber-600",
  paid: "bg-admin-success/12 text-admin-success",
  cancelled: "bg-admin-danger/12 text-admin-danger",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        toneClasses[status],
      )}
    >
      {invoiceStatusLabel(status)}
    </span>
  );
}
