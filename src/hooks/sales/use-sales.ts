"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import { fetchSaleById, fetchSales } from "@/services/sale.service";
import type { Sale } from "@/types/sale.types";

/** Sale list, seeded with server-fetched data so the table paints instantly. */
export function useSales(initialData: Sale[]) {
  return useQuery({
    queryKey: queryKeys.sales.list(),
    queryFn: fetchSales,
    initialData,
  });
}

/** A single sale's detail, seeded from the server-rendered page. */
export function useSale(id: string, initialData: Sale) {
  return useQuery({
    queryKey: queryKeys.sales.detail(id),
    queryFn: async () => {
      const sale = await fetchSaleById(id);
      if (!sale) throw new Error("Sale not found.");
      return sale;
    },
    initialData,
  });
}
