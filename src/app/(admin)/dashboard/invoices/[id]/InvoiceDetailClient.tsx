"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { useInvoice } from "@/hooks/invoices/use-invoices";
import {
  useDeleteInvoice,
  useUpdateInvoiceStatus,
} from "@/hooks/invoices/use-invoice-mutations";
import { notify } from "@/lib/toast";
import type { BusinessProfile, Invoice } from "@/types/invoice.types";
import { InvoiceTemplate } from "../InvoiceTemplate";

interface InvoiceDetailClientProps {
  initialInvoice: Invoice;
  profile: BusinessProfile | null;
  currency: { code: string; locale: string };
  can: { edit: boolean; delete: boolean };
}

export function InvoiceDetailClient({
  initialInvoice,
  profile,
  currency,
  can,
}: InvoiceDetailClientProps) {
  const { data: invoice } = useInvoice(initialInvoice.id, initialInvoice);
  const router = useRouter();
  const confirm = useConfirm();
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();

  const busy = updateStatus.isPending || deleteInvoice.isPending;

  function setStatus(status: Invoice["status"], message: string) {
    updateStatus.mutate(
      { id: invoice.id, status },
      { onSuccess: () => notify.success(message) },
    );
  }

  async function handleCancel() {
    const ok = await confirm({
      title: "Cancel invoice",
      description:
        "This invoice will be marked as cancelled. You can reopen it later if needed.",
      confirmLabel: "Cancel invoice",
      cancelLabel: "Keep invoice",
      destructive: true,
    });
    if (!ok) return;
    setStatus("cancelled", "Invoice cancelled.");
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete invoice",
      description:
        "Permanently delete this invoice. The sale it was generated from is not affected. This cannot be undone.",
      confirmLabel: "Delete invoice",
      destructive: true,
    });
    if (!ok) return;
    deleteInvoice.mutate(invoice.id, {
      onSuccess: () => {
        notify.success("Invoice deleted.");
        router.push("/dashboard/invoices");
      },
    });
  }

  return (
    <div>
      <Link
        href="/dashboard/invoices"
        className="text-admin-text-muted hover:text-admin-text mb-6 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>

      {/* Action bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-admin-accent hover:bg-admin-accent-hover flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <Link
          href={`/dashboard/invoices/${invoice.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-admin-border text-admin-text hover:bg-admin-card flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors"
        >
          Print view
        </Link>

        {can.edit && invoice.status !== "paid" && (
          <button
            type="button"
            onClick={() => setStatus("paid", "Invoice marked as paid.")}
            disabled={busy}
            className="border-admin-success/30 text-admin-success hover:bg-admin-success/10 flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Mark paid
          </button>
        )}
        {can.edit && invoice.status !== "issued" && (
          <button
            type="button"
            onClick={() => setStatus("issued", "Invoice reopened.")}
            disabled={busy}
            className="border-admin-border text-admin-text hover:bg-admin-card flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Reopen
          </button>
        )}
        {can.edit && invoice.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={busy}
            className="border-admin-border text-admin-text-muted hover:bg-admin-card flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40"
          >
            <Ban className="h-4 w-4" />
            Cancel
          </button>
        )}
        {can.delete && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="border-admin-danger/30 text-admin-danger hover:bg-admin-danger/10 flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>

      {/* The receipt is a fixed 80 mm wide, so centre it on the page. */}
      <div className="border-admin-border mx-auto w-fit overflow-hidden rounded-2xl border bg-white shadow-sm print:m-0 print:rounded-none print:border-0 print:shadow-none">
        <InvoiceTemplate
          invoice={invoice}
          profile={profile}
          currency={currency}
        />
      </div>
    </div>
  );
}
