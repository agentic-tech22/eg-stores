"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createSalaryRecord,
  createUserDocument,
  createUserNote,
  deleteSalaryRecord,
  deleteUserDocument,
  deleteUserNote,
  fetchUserRecords,
} from "@/services/user-records.service";
import type {
  CreateSalaryRecordInput,
  CreateUserDocumentInput,
  UserHrRecords,
} from "@/types/user-record.types";

/** Reads a user's personnel file (documents, salary, notes). */
export function useUserRecords(userId: string, initialData?: UserHrRecords) {
  return useQuery({
    queryKey: queryKeys.users.records(userId),
    queryFn: () => fetchUserRecords(userId),
    initialData,
  });
}

/** Shared invalidation for every record mutation: refetches the user's file. */
function useRecordInvalidation(userId: string) {
  const queryClient = useQueryClient();
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.records(userId),
      }),
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateUserDocument(userId: string) {
  const handlers = useRecordInvalidation(userId);
  return useMutation({
    mutationFn: async (input: CreateUserDocumentInput) =>
      unwrap(await createUserDocument(userId, input)),
    ...handlers,
  });
}

export function useDeleteUserDocument(userId: string) {
  const handlers = useRecordInvalidation(userId);
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteUserDocument(id)),
    ...handlers,
  });
}

export function useCreateSalaryRecord(userId: string) {
  const handlers = useRecordInvalidation(userId);
  return useMutation({
    mutationFn: async (input: CreateSalaryRecordInput) =>
      unwrap(await createSalaryRecord(userId, input)),
    ...handlers,
  });
}

export function useDeleteSalaryRecord(userId: string) {
  const handlers = useRecordInvalidation(userId);
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteSalaryRecord(id)),
    ...handlers,
  });
}

export function useCreateUserNote(userId: string) {
  const handlers = useRecordInvalidation(userId);
  return useMutation({
    mutationFn: async (body: string) => unwrap(await createUserNote(userId, body)),
    ...handlers,
  });
}

export function useDeleteUserNote(userId: string) {
  const handlers = useRecordInvalidation(userId);
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteUserNote(id)),
    ...handlers,
  });
}
