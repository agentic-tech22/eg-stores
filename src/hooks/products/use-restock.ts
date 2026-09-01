"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import { fetchProductHistory, restockProduct } from "@/services/restock.service";

type RestockInput = Parameters<typeof restockProduct>[0];

/**
 * Records a restock. On success, invalidates the product list (stock changed)
 * and that product's history so both the table and any open history view
 * refresh. Errors surface via toast.
 */
export function useRestockProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RestockInput) => unwrap(await restockProduct(input)),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.history(input.productId),
      });
    },
    onError: (error: Error) => notify.fromError(error),
  });
}

/** Reads a product's restock + price-change history. Disabled until `enabled`. */
export function useProductHistory(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.products.history(productId),
    queryFn: () => fetchProductHistory(productId),
    enabled,
  });
}
