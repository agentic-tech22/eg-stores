"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import { fetchInvoiceById, fetchInvoices } from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice.types";

/** Invoice list, seeded with server-fetched data so the table paints instantly. */
export function useInvoices(initialData: Invoice[]) {
  return useQuery({
    queryKey: queryKeys.invoices.list(),
    queryFn: fetchInvoices,
    initialData,
  });
}

/** A single invoice's detail, seeded from the server-rendered page. */
export function useInvoice(id: string, initialData: Invoice) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async () => {
      const invoice = await fetchInvoiceById(id);
      if (!invoice) throw new Error("Invoice not found.");
      return invoice;
    },
    initialData,
  });
}
