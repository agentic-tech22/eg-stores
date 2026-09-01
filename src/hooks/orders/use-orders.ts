"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import { fetchOrderById, fetchOrders } from "@/services/order.service";
import type { Order } from "@/types/order.types";

/** Order list, seeded with server-fetched data so the table paints instantly. */
export function useOrders(initialData: Order[]) {
  return useQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: fetchOrders,
    initialData,
  });
}

/** A single order's detail, seeded from the server-rendered page. */
export function useOrder(id: string, initialData: Order) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: async () => {
      const order = await fetchOrderById(id);
      if (!order) throw new Error("Order not found.");
      return order;
    },
    initialData,
  });
}
