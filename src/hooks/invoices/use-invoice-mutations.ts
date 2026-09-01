"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  deleteInvoice,
  generateInvoiceForSale,
  updateInvoiceStatus,
} from "@/services/invoice.service";
import type { InvoiceStatus } from "@/types/invoice.types";

/** Invalidate invoices (and sales, whose detail shows invoice state) after a write. */
function useInvoiceInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useGenerateInvoice() {
  const handlers = useInvoiceInvalidation();
  return useMutation({
    mutationFn: async (saleId: string) =>
      unwrap(await generateInvoiceForSale(saleId)),
    ...handlers,
  });
}

export function useUpdateInvoiceStatus() {
  const handlers = useInvoiceInvalidation();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: InvoiceStatus;
    }) => unwrap(await updateInvoiceStatus(id, status)),
    ...handlers,
  });
}

export function useDeleteInvoice() {
  const handlers = useInvoiceInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteInvoice(id)),
    ...handlers,
  });
}
