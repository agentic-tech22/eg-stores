"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { useGenerateInvoice } from "@/hooks/invoices/use-invoice-mutations";
import { notify } from "@/lib/toast";
import type { Invoice } from "@/types/invoice.types";

interface GenerateInvoiceButtonProps {
  saleId: string;
  /** An invoice already generated for this sale, if any. */
  invoice: Invoice | null;
  can: { viewInvoice: boolean; generateInvoice: boolean };
}

export function GenerateInvoiceButton({
  saleId,
  invoice,
  can,
}: GenerateInvoiceButtonProps) {
  const router = useRouter();
  const generate = useGenerateInvoice();

  // Already invoiced → link straight to it (visible to anyone who can view).
  if (invoice) {
    if (!can.viewInvoice) return null;
    return (
      <Link
        href={`/dashboard/invoices/${invoice.id}`}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card"
      >
        <FileText className="h-4 w-4" />
        View invoice
      </Link>
    );
  }

  if (!can.generateInvoice) return null;

  function handleGenerate() {
    generate.mutate(saleId, {
      onSuccess: (result) => {
        if (result.warning) notify.error(`⚠️ ${result.warning}`);
        else notify.success("Invoice generated.");
        if (result.invoiceId) {
          router.push(`/dashboard/invoices/${result.invoiceId}`);
        }
      },
      onError: (error) => {
        // Missing business profile is the common case: point the user there.
        if (error.message.toLowerCase().includes("business profile")) {
          router.push("/dashboard/settings/business");
        }
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={generate.isPending}
      className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card disabled:opacity-40"
    >
      <FileText className="h-4 w-4" />
      {generate.isPending ? "Generating..." : "Generate invoice"}
    </button>
  );
}
