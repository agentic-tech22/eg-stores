"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { getAuthContext, requirePermission } from "@/lib/auth/session";
import {
  getAllSalaryRecords,
  getExpenses,
  getProfileEmails,
} from "@/queries/expense.query";
import { mapExpenseRow } from "@/services/expense-engine";
import { deleteExpenseReceipt } from "@/services/upload.service";
import type {
  Expense,
  ExpenseInput,
  SalaryExpense,
} from "@/types/expense.types";

type Result = { success: boolean; error?: string };

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toAmount(value: number | undefined | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Every recorded expense, newest first. */
export async function fetchExpenses(): Promise<Expense[]> {
  await requirePermission("expenses.view");
  const rows = await getExpenses();
  return rows.map(mapExpenseRow);
}

/**
 * Payroll entries for the expense report, labelled with the employee's email.
 *
 * `user_salary_records` is the admin-only personnel file, so this returns an
 * empty list for a non-admin rather than throwing: an `expenses.view` member is
 * meant to see the operating costs, just not what individuals are paid. The
 * page hides the payroll figures entirely in that case.
 */
export async function fetchSalaryExpenses(): Promise<SalaryExpense[]> {
  await requirePermission("expenses.view");
  const ctx = await getAuthContext();
  if (!ctx?.isAdmin) return [];

  const [rows, emails] = await Promise.all([
    getAllSalaryRecords(),
    getProfileEmails(),
  ]);

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    employeeEmail: emails.get(row.user_id) ?? null,
    type: row.type,
    amount: Number(row.amount ?? 0),
    effectiveDate: row.effective_date,
    note: row.note,
  }));
}

function validateExpense(input: ExpenseInput): string | null {
  if (!input.title?.trim()) return "A title is required.";
  if (!input.expenseDate) return "A date is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Amount must be greater than zero.";
  return null;
}

export async function createExpense(input: ExpenseInput): Promise<Result> {
  try {
    const ctx = await requirePermission("expenses.create");
    const invalid = validateExpense(input);
    if (invalid) return { success: false, error: invalid };

    const supabase = createAdminClient();
    const { error } = await supabase.from("business_expenses").insert({
      title: input.title.trim(),
      category: cleanText(input.category),
      amount: toAmount(input.amount),
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod ?? "cash",
      reference: cleanText(input.reference),
      notes: cleanText(input.notes),
      attachments: input.attachments ?? [],
      created_by: ctx.userId,
      created_by_email: ctx.email,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseInput,
): Promise<Result> {
  try {
    await requirePermission("expenses.edit");
    const invalid = validateExpense(input);
    if (invalid) return { success: false, error: invalid };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("business_expenses")
      .update({
        title: input.title.trim(),
        category: cleanText(input.category),
        amount: toAmount(input.amount),
        expense_date: input.expenseDate,
        payment_method: input.paymentMethod ?? "cash",
        reference: cleanText(input.reference),
        notes: cleanText(input.notes),
        attachments: input.attachments ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", expenseId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function deleteExpense(expenseId: string): Promise<Result> {
  try {
    await requirePermission("expenses.delete");
    const supabase = createAdminClient();

    // Fetch the row first so its receipts can be cleaned from storage.
    const { data } = await supabase
      .from("business_expenses")
      .select("attachments")
      .eq("id", expenseId)
      .maybeSingle();

    const { error } = await supabase
      .from("business_expenses")
      .delete()
      .eq("id", expenseId);
    if (error) return { success: false, error: error.message };

    const attachments = (data as { attachments: { url: string }[] } | null)
      ?.attachments;
    if (Array.isArray(attachments)) {
      await Promise.all(
        attachments.map((a) =>
          deleteExpenseReceipt(a.url).catch(() => undefined),
        ),
      );
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
