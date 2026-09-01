"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import {
  SALE_SETTLEMENT_INVALIDATIONS,
  SALE_WRITE_INVALIDATIONS,
} from "@/lib/react-query/invalidation";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createSale,
  deleteSale,
  deleteSalePayment,
  markSalePaid,
  recordSalePayment,
  updateSale,
} from "@/services/sale.service";
import type {
  CreateSaleInput,
  RecordSalePaymentInput,
} from "@/types/sale.types";

/**
 * Invalidate everything a sale write touches. Recording, editing or deleting a
 * sale deducts or restores stock, so the product list and the per-warehouse
 * inventory are stale too: invalidating only `sales.all` leaves the products
 * page showing the pre-sale counts until a hard reload. The set itself lives in
 * `react-query/invalidation` so it can be asserted in a test.
 */
function useSaleInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      for (const queryKey of SALE_WRITE_INVALIDATIONS) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateSale() {
  const handlers = useSaleInvalidation();
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => unwrap(await createSale(input)),
    ...handlers,
  });
}

export function useUpdateSale() {
  const handlers = useSaleInvalidation();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateSaleInput }) =>
      unwrap(await updateSale(id, input)),
    ...handlers,
  });
}

export function useDeleteSale() {
  const handlers = useSaleInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteSale(id)),
    ...handlers,
  });
}

/** Settlement writes touch the sale, its payment ledger, and its invoice. */
function useSettlementInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      for (const queryKey of SALE_SETTLEMENT_INVALIDATIONS) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useMarkSalePaid() {
  return useMutation({
    mutationFn: async (id: string) => unwrap(await markSalePaid(id)),
    ...useSettlementInvalidation(),
  });
}

/** Record a later collection against a sale's outstanding due. */
export function useRecordSalePayment() {
  return useMutation({
    mutationFn: async ({
      saleId,
      input,
    }: {
      saleId: string;
      input: RecordSalePaymentInput;
    }) => unwrap(await recordSalePayment(saleId, input)),
    ...useSettlementInvalidation(),
  });
}

/** Remove a wrongly-entered collection from a sale's ledger. */
export function useDeleteSalePayment() {
  return useMutation({
    mutationFn: async (paymentId: string) =>
      unwrap(await deleteSalePayment(paymentId)),
    ...useSettlementInvalidation(),
  });
}
