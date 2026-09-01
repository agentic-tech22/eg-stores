"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import type { PermissionId, Role } from "@/lib/auth/permissions";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  deleteUser,
  inviteUser,
  setUserActive,
  updateUserDefaultWarehouse,
  updateUserPermissions,
  updateUserRole,
} from "@/services/user.service";

type InviteInput = Parameters<typeof inviteUser>[0];

/**
 * Shared invalidation + error handling for every user mutation. On success we
 * invalidate the whole `users` key so the list refetches in place; on error we
 * surface the message via toast.
 */
function useUserInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useInviteUser() {
  const handlers = useUserInvalidation();
  return useMutation({
    mutationFn: async (input: InviteInput) => unwrap(await inviteUser(input)),
    ...handlers,
  });
}

export function useDeleteUser() {
  const handlers = useUserInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteUser(id)),
    ...handlers,
  });
}

/** Activate or deactivate an account (blocks login + all operations). */
export function useSetUserActive() {
  const handlers = useUserInvalidation();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      unwrap(await setUserActive(id, isActive)),
    ...handlers,
  });
}

/**
 * Saves a user's role and (for members) permissions in one operation. Role is
 * updated first; permissions only when the resulting role is "member".
 */
export function useSaveUser() {
  const handlers = useUserInvalidation();
  return useMutation({
    mutationFn: async ({
      id,
      role,
      currentRole,
      permissions,
      defaultWarehouseId,
    }: {
      id: string;
      role: Role;
      currentRole: Role;
      permissions: PermissionId[];
      /** Undefined = leave unchanged; string|null = set/clear. */
      defaultWarehouseId?: string | null;
    }) => {
      if (role !== currentRole) {
        unwrap(await updateUserRole(id, role));
      }
      if (role === "member") {
        unwrap(await updateUserPermissions(id, permissions));
      }
      if (defaultWarehouseId !== undefined) {
        unwrap(await updateUserDefaultWarehouse(id, defaultWarehouseId));
      }
    },
    ...handlers,
  });
}
