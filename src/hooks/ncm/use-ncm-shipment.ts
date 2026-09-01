"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  addNcmComment,
  bulkShipToNcm,
  fetchNcmBranches,
  listNcmComments,
  returnNcmOrder,
  shipToNcm,
  syncNcmStatus,
} from "@/services/ncm.service";
import type { NcmDeliveryType } from "@/types/ncm.types";

type ShipInput = Parameters<typeof shipToNcm>[1];
type BulkShipInput = {
  items: Parameters<typeof bulkShipToNcm>[0];
  shared: Parameters<typeof bulkShipToNcm>[1];
};

function useShipmentInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useNcmBranches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.ncmBranches.all,
    queryFn: fetchNcmBranches,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNcmComments(orderId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ncmComments.list(orderId),
    queryFn: () => listNcmComments(orderId),
    enabled,
  });
}

export function useShipToNcm() {
  const handlers = useShipmentInvalidation();
  return useMutation({
    mutationFn: async ({
      orderId,
      opts,
    }: {
      orderId: string;
      opts: ShipInput;
    }) => unwrap(await shipToNcm(orderId, opts)),
    ...handlers,
  });
}

export function useBulkShipToNcm() {
  const handlers = useShipmentInvalidation();
  return useMutation({
    mutationFn: async ({ items, shared }: BulkShipInput) =>
      unwrap(await bulkShipToNcm(items, shared)),
    ...handlers,
  });
}

export function useSyncNcmStatus() {
  const handlers = useShipmentInvalidation();
  return useMutation({
    mutationFn: async (orderId: string) => unwrap(await syncNcmStatus(orderId)),
    ...handlers,
  });
}

export function useReturnNcmOrder() {
  const handlers = useShipmentInvalidation();
  return useMutation({
    mutationFn: async ({
      orderId,
      comment,
    }: {
      orderId: string;
      comment?: string;
    }) => unwrap(await returnNcmOrder(orderId, comment)),
    ...handlers,
  });
}

export function useAddNcmComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      comment,
    }: {
      orderId: string;
      comment: string;
    }) => unwrap(await addNcmComment(orderId, comment)),
    onSuccess: (_data, { orderId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.ncmComments.list(orderId),
      }),
    onError: (error: Error) => notify.fromError(error),
  });
}

export type { NcmDeliveryType };
