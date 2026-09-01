"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import { createCombo, deleteCombo, updateCombo } from "@/services/combo.service";

type CreateInput = Parameters<typeof createCombo>[0];
type UpdateInput = Parameters<typeof updateCombo>[1];

/**
 * Shared invalidation + error handling for combo mutations. Combos live in the
 * products table, so we also invalidate `products` to keep storefront/product
 * caches fresh.
 */
function useComboInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.combos.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateCombo() {
  const handlers = useComboInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createCombo(input)),
    ...handlers,
  });
}

export function useUpdateCombo() {
  const handlers = useComboInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput }) =>
      unwrap(await updateCombo(id, data)),
    ...handlers,
  });
}

export function useToggleComboFeatured() {
  const handlers = useComboInvalidation();
  return useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      unwrap(await updateCombo(id, { isFeatured })),
    ...handlers,
  });
}

export function useDeleteCombo() {
  const handlers = useComboInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCombo(id)),
    ...handlers,
  });
}
