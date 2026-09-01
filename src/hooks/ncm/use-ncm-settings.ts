"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  getNcmSettingsForAdmin,
  refreshNcmBranches,
  updateNcmSettings,
} from "@/services/ncm.service";

type UpdateInput = Parameters<typeof updateNcmSettings>[0];

export function useNcmSettings(
  initialData: Awaited<ReturnType<typeof getNcmSettingsForAdmin>>,
) {
  return useQuery({
    queryKey: queryKeys.ncmSettings.all,
    queryFn: getNcmSettingsForAdmin,
    initialData,
  });
}

export function useUpdateNcmSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInput) =>
      unwrap(await updateNcmSettings(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ncmSettings.all });
      notify.success("NCM settings saved.");
    },
    onError: (error: Error) => notify.fromError(error),
  });
}

export function useRefreshNcmBranches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await refreshNcmBranches();
      if (!result.success) {
        throw new Error(result.error ?? "Could not refresh branches.");
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ncmBranches.all });
      notify.success(`Loaded ${result.count ?? 0} NCM branches.`);
    },
    onError: (error: Error) => notify.fromError(error),
  });
}
