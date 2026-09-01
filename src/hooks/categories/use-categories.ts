"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from "@/services/category.service";
import type { Category } from "@/types/product.types";

type CreateInput = Parameters<typeof createCategory>[0];
type UpdateInput = Parameters<typeof updateCategory>[1];

/**
 * Reads the category list. Seed with server-fetched `initialData` where
 * available so the view paints immediately; omit it (defaults to []) in places
 * that only need the list client-side, e.g. the product form's selector.
 */
export function useCategories(initialData?: Category[]) {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: fetchCategories,
    initialData,
  });
}

/** Shared invalidation + error handling for every category mutation. */
function useCategoryInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateCategory() {
  const handlers = useCategoryInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createCategory(input)),
    ...handlers,
  });
}

export function useUpdateCategory() {
  const handlers = useCategoryInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput }) =>
      unwrap(await updateCategory(id, data)),
    ...handlers,
  });
}

export function useDeleteCategory() {
  const handlers = useCategoryInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCategory(id)),
    ...handlers,
  });
}
