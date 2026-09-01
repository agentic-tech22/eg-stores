"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createCustomer,
  createLoyaltyTransaction,
  deleteCustomer,
  deleteLoyaltyTransaction,
  fetchCustomers,
  fetchLoyaltyTransactions,
  updateCustomer,
  updateLoyaltyTransaction,
} from "@/services/customer.service";
import type {
  CustomerWithBalance,
  LoyaltyTransaction,
} from "@/types/customer.types";

type CreateInput = Parameters<typeof createCustomer>[0];
type UpdateInput = Parameters<typeof updateCustomer>[1];
type LoyaltyInput = Parameters<typeof createLoyaltyTransaction>[0];

/** Reads the customer list (with derived balances). Seeded with server `initialData`. */
export function useCustomers(initialData: CustomerWithBalance[]) {
  return useQuery({
    queryKey: queryKeys.customers.list(),
    queryFn: fetchCustomers,
    initialData,
  });
}

/** Reads one customer's loyalty ledger. Seeded with server `initialData`. */
export function useLoyaltyTransactions(
  customerId: string,
  initialData: LoyaltyTransaction[],
) {
  return useQuery({
    queryKey: queryKeys.customers.transactions(customerId),
    queryFn: () => fetchLoyaltyTransactions(customerId),
    initialData,
  });
}

/** Shared invalidation + error handling for every customer mutation. */
function useCustomerInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateCustomer() {
  const handlers = useCustomerInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createCustomer(input)),
    ...handlers,
  });
}

export function useUpdateCustomer() {
  const handlers = useCustomerInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput }) =>
      unwrap(await updateCustomer(id, data)),
    ...handlers,
  });
}

export function useDeleteCustomer() {
  const handlers = useCustomerInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCustomer(id)),
    ...handlers,
  });
}

export function useCreateLoyaltyTransaction() {
  const handlers = useCustomerInvalidation();
  return useMutation({
    mutationFn: async (input: LoyaltyInput) =>
      unwrap(await createLoyaltyTransaction(input)),
    ...handlers,
  });
}

export function useUpdateLoyaltyTransaction() {
  const handlers = useCustomerInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LoyaltyInput }) =>
      unwrap(await updateLoyaltyTransaction(id, data)),
    ...handlers,
  });
}

export function useDeleteLoyaltyTransaction() {
  const handlers = useCustomerInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await deleteLoyaltyTransaction(id)),
    ...handlers,
  });
}
