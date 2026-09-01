"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import { upsertBusinessProfile } from "@/services/invoice.service";
import type { BusinessProfileInput } from "@/types/invoice.types";

export function useUpsertBusinessProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BusinessProfileInput) =>
      unwrap(await upsertBusinessProfile(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.businessProfile.all,
      }),
    onError: (error: Error) => notify.fromError(error),
  });
}
