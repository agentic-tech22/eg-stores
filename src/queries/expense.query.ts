import { createAdminClient } from "@/lib/supabase/server";
import type { ExpenseRow } from "@/types/expense.types";
import type { SalaryRecordRow } from "@/types/user-record.types";

/**
 * Expense reads use the service-role client because `business_expenses` has no
 * public RLS policy (operating costs are business-private). Callers in the
 * service layer gate access with `requirePermission("expenses.view")`.
 */

/** Every expense, newest first. */
export async function getExpenses(): Promise<ExpenseRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch expenses:", error.message);
    return [];
  }
  return (data ?? []) as ExpenseRow[];
}

/**
 * Every salary record across all employees, newest first — the payroll side of
 * the expense report. Rows are the personnel file's own; nothing is copied.
 */
export async function getAllSalaryRecords(): Promise<SalaryRecordRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_salary_records")
    .select("id, user_id, effective_date, amount, type, note")
    .order("effective_date", { ascending: false });

  if (error) {
    console.error("Failed to fetch salary records:", error.message);
    return [];
  }
  return (data ?? []) as SalaryRecordRow[];
}

/**
 * id → email for every profile, so payroll rows can be labelled with the
 * employee they belong to without a join Supabase cannot express here
 * (`user_salary_records` references auth.users, not profiles).
 */
export async function getProfileEmails(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("profiles").select("id, email");

  if (error) {
    console.error("Failed to fetch profile emails:", error.message);
    return new Map();
  }
  const rows = (data ?? []) as { id: string; email: string }[];
  return new Map(rows.map((r) => [r.id, r.email]));
}
