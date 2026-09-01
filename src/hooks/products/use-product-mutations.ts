"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/services/product.service";

type CreateInput = Parameters<typeof createProduct>[0];
type UpdateInput = Parameters<typeof updateProduct>[1];

/**
 * Shared invalidation + error handling for every product mutation. On success
 * we invalidate the whole `products` key so the list refetches in place; on
 * error we surface the message via toast.
 */
function useProductInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateProduct() {
  const handlers = useProductInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createProduct(input)),
    ...handlers,
  });
}

export function useUpdateProduct() {
  const handlers = useProductInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput }) =>
      unwrap(await updateProduct(id, data)),
    ...handlers,
  });
}

export function useToggleFeatured() {
  const handlers = useProductInvalidation();
  return useMutation({
    mutationFn: async ({
      id,
      isFeatured,
    }: {
      id: string;
      isFeatured: boolean;
    }) => unwrap(await updateProduct(id, { isFeatured })),
    ...handlers,
  });
}

export function useDeleteProduct() {
  const handlers = useProductInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteProduct(id)),
    ...handlers,
  });
}
