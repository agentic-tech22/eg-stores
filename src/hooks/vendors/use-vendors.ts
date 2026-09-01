"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createVendor,
  createVendorTransaction,
  deleteVendor,
  deleteVendorTransaction,
  fetchVendorPurchases,
  fetchVendors,
  fetchVendorTransactions,
  setVendorBillStatus,
  updateVendor,
  updateVendorTransaction,
} from "@/services/vendor.service";
import type {
  VendorBillStatus,
  VendorPurchase,
  VendorTransaction,
  VendorWithBalance,
} from "@/types/vendor.types";

type CreateInput = Parameters<typeof createVendor>[0];
type UpdateInput = Parameters<typeof updateVendor>[1];
type TxnInput = Parameters<typeof createVendorTransaction>[0];

/** Reads the vendor list (with derived balances). Seeded with server `initialData`. */
export function useVendors(initialData: VendorWithBalance[]) {
  return useQuery({
    queryKey: queryKeys.vendors.list(),
    queryFn: fetchVendors,
    initialData,
  });
}

/** Reads all vendor bills (for date-range purchase totals). Seeded with server data. */
export function useVendorPurchases(initialData: VendorPurchase[]) {
  return useQuery({
    queryKey: queryKeys.vendors.purchases(),
    queryFn: fetchVendorPurchases,
    initialData,
  });
}

/** Reads one vendor's ledger. Seeded with server `initialData`. */
export function useVendorTransactions(
  vendorId: string,
  initialData: VendorTransaction[],
) {
  return useQuery({
    queryKey: queryKeys.vendors.transactions(vendorId),
    queryFn: () => fetchVendorTransactions(vendorId),
    initialData,
  });
}

/** Shared invalidation + error handling for every vendor mutation. */
function useVendorInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateVendor() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createVendor(input)),
    ...handlers,
  });
}

export function useUpdateVendor() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput }) =>
      unwrap(await updateVendor(id, data)),
    ...handlers,
  });
}

export function useDeleteVendor() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteVendor(id)),
    ...handlers,
  });
}

export function useCreateVendorTransaction() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async (input: TxnInput) =>
      unwrap(await createVendorTransaction(input)),
    ...handlers,
  });
}

export function useUpdateVendorTransaction() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TxnInput }) =>
      unwrap(await updateVendorTransaction(id, data)),
    ...handlers,
  });
}

/** Marks a bill paid / unpaid from the ledger row, without opening the editor. */
export function useSetVendorBillStatus() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      paidAt,
    }: {
      id: string;
      status: VendorBillStatus;
      /** Settlement date; the server falls back to the bill date when omitted. */
      paidAt?: string | null;
    }) => unwrap(await setVendorBillStatus(id, status, paidAt)),
    ...handlers,
  });
}

export function useDeleteVendorTransaction() {
  const handlers = useVendorInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await deleteVendorTransaction(id)),
    ...handlers,
  });
}
