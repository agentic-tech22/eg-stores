"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  cancelOrder,
  createOrder,
  deleteOrder,
  restockOrder,
  updateOrderDiscount,
  updateOrderStatus,
} from "@/services/order.service";
import { convertOrderToSale } from "@/services/sale.service";
import type { CreateOrderInput, OrderStatus } from "@/types/order.types";

/** Invalidate the order list and (optionally) a specific order's detail. */
function useOrderInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateOrder() {
  const handlers = useOrderInvalidation();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) =>
      unwrap(await createOrder(input)),
    ...handlers,
  });
}

export function useUpdateOrderStatus() {
  const handlers = useOrderInvalidation();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) =>
      unwrap(await updateOrderStatus(id, status)),
    ...handlers,
  });
}

/**
 * Change an order's discount after creation. Only permitted before the order
 * ships; the server rejects anything later.
 */
export function useUpdateOrderDiscount() {
  const handlers = useOrderInvalidation();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) =>
      unwrap(await updateOrderDiscount(id, amount)),
    ...handlers,
  });
}

export function useCancelOrder() {
  const handlers = useOrderInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await cancelOrder(id)),
    ...handlers,
  });
}

/**
 * Permanently remove a cancelled order. The server refuses anything that still
 * holds stock or has a sale attached.
 */
export function useDeleteOrder() {
  const handlers = useOrderInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteOrder(id)),
    ...handlers,
  });
}

export function useRestockOrder() {
  const handlers = useOrderInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await restockOrder(id)),
    ...handlers,
  });
}

/**
 * Convert a delivered order into a sale. Invalidates both orders (to refresh the
 * "converted" link) and sales (the new revenue record shows up immediately).
 */
export function useConvertOrderToSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await convertOrderToSale(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
    },
    onError: (error: Error) => notify.fromError(error),
  });
}
