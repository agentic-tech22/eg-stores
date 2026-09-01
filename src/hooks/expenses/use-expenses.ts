"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { queryKeys } from "@/lib/react-query/keys";
import { unwrap } from "@/lib/react-query/unwrap";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  fetchSalaryExpenses,
  updateExpense,
} from "@/services/expense.service";
import type { Expense, SalaryExpense } from "@/types/expense.types";

type CreateInput = Parameters<typeof createExpense>[0];

/** Reads the expense ledger. Seeded with server `initialData`. */
export function useExpenses(initialData: Expense[]) {
  return useQuery({
    queryKey: queryKeys.expenses.list(),
    queryFn: fetchExpenses,
    initialData,
  });
}

/** Reads payroll entries (admin only; empty for everyone else). */
export function useSalaryExpenses(initialData: SalaryExpense[]) {
  return useQuery({
    queryKey: queryKeys.expenses.salaries(),
    queryFn: fetchSalaryExpenses,
    initialData,
  });
}

/** Shared invalidation + error handling for every expense mutation. */
function useExpenseInvalidation() {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
    onError: (error: Error) => notify.fromError(error),
  };
}

export function useCreateExpense() {
  const handlers = useExpenseInvalidation();
  return useMutation({
    mutationFn: async (input: CreateInput) => unwrap(await createExpense(input)),
    ...handlers,
  });
}

export function useUpdateExpense() {
  const handlers = useExpenseInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateInput }) =>
      unwrap(await updateExpense(id, data)),
    ...handlers,
  });
}

export function useDeleteExpense() {
  const handlers = useExpenseInvalidation();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteExpense(id)),
    ...handlers,
  });
}
