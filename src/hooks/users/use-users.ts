"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import { listUsers } from "@/services/user.service";
import type { ManagedUser } from "@/types/user.types";

/**
 * Reads the user list. Seeded with the server-fetched `initialData` so the
 * admin table paints immediately, then stays in sync via cache invalidation
 * after mutations.
 */
export function useUsers(initialData: ManagedUser[]) {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: listUsers,
    initialData,
  });
}
