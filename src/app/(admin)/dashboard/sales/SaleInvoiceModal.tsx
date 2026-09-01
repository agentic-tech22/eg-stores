"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/molecules/admin";
import { Modal } from "@/components/molecules/modal/Modal";
import { InvoiceTemplate } from "@/app/(admin)/dashboard/invoices/InvoiceTemplate";
import {
  fetchBusinessProfile,
  fetchInvoiceById,
} from "@/services/invoice.service";
import { queryKeys } from "@/lib/react-query/keys";

interface SaleInvoiceModalProps {
  /** The invoice generated for the just-completed sale. */
  invoiceId: string;
  currency: { code: string; locale: string };
  /** Close the modal (the sale is already recorded + invoiced regardless). */
  onClose: () => void;
}

/**
 * Shows the invoice generated for a completed POS sale inside a modal, without
 * leaving the sale page, and lets the cashier choose whether to print it. The
 * preview renders `InvoiceTemplate` inline (clean, no dashboard chrome); the
 * Print button prints a hidden iframe of the dedicated print route so only the
 * invoice is sent to the printer.
 */
export function SaleInvoiceModal({
  invoiceId,
  currency,
  onClose,
}: SaleInvoiceModalProps) {
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  const invoiceQuery = useQuery({
    queryKey: queryKeys.invoices.detail(invoiceId),
    queryFn: () => fetchInvoiceById(invoiceId),
    staleTime: Infinity,
  });
  const profileQuery = useQuery({
    queryKey: queryKeys.businessProfile.all,
    queryFn: () => fetchBusinessProfile(),
    staleTime: Infinity,
  });

  const invoice = invoiceQuery.data;

  function handlePrint() {
    printFrameRef.current?.contentWindow?.print();
  }

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="sm"
      title="Invoice"
      description="The sale is recorded. Print the invoice now, or close to skip."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handlePrint} disabled={!invoice}>
            <Printer className="h-4 w-4" />
            Print invoice
          </Button>
        </>
      }
    >
      <div className="border-admin-border flex max-h-[60vh] items-start justify-center overflow-y-auto rounded-xl border bg-admin-bg p-3">
        {invoice ? (
          <div className="shadow-sm">
            <InvoiceTemplate
              invoice={invoice}
              profile={profileQuery.data ?? null}
              currency={currency}
            />
          </div>
        ) : (
          <div className="flex h-60 w-full items-center justify-center">
            <Loader2 className="text-admin-accent h-8 w-8 animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden iframe used only to print the invoice in isolation. */}
      <iframe
        ref={printFrameRef}
        src={`/dashboard/invoices/${invoiceId}/print?auto=0`}
        title="Invoice print frame"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
      />
    </Modal>
  );
}
