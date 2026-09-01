"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createWarehouse,
  deleteWarehouse,
  fetchWarehouses,
  setDefaultWarehouse,
  transferStock,
  updateWarehouse,
} from "@/services/warehouse.service";
import type { Warehouse } from "@/types/warehouse.types";

type CreateInput = Parameters<typeof createWarehouse>[0];
type UpdateInput = Parameters<typeof updateWarehouse>[1];
type TransferInput = Parameters<typeof transferStock>[0];

/** Reads the warehouse list. Seed with server-fetched `initialData` where able. */
export function useWarehouses(initialData?: Warehouse[]) {
  return useQuery({
    queryKey: queryKeys.warehouses.list(),
    queryFn: fetchWarehouses,
    initialData,
  });
}

/** Shared invalidation + error handling for every warehouse mutation. */
function useWarehouseInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateWarehouse() {
  const handlers = useWarehouseInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createWarehouse(input)),
    ...handlers,
  });
}

export function useUpdateWarehouse() {
  const handlers = useWarehouseInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput }) =>
      unwrap(await updateWarehouse(id, data)),
    ...handlers,
  });
}

export function useDeleteWarehouse() {
  const handlers = useWarehouseInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteWarehouse(id)),
    ...handlers,
  });
}

export function useSetDefaultWarehouse() {
  const handlers = useWarehouseInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await setDefaultWarehouse(id)),
    ...handlers,
  });
}

export function useTransferStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransferInput) => unwrap(await transferStock(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error: Error) => notify.fromError(error),
  });
}
