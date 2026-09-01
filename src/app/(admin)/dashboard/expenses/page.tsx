import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import {
  fetchExpenses,
  fetchSalaryExpenses,
} from "@/services/expense.service";
import type { Expense, SalaryExpense } from "@/types/expense.types";
import { ExpensesManager } from "./ExpensesManager";

export default async function ExpensesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "expenses.view")) redirect("/dashboard");

  let expenses: Expense[] = [];
  let salaries: SalaryExpense[] = [];
  try {
    // fetchSalaryExpenses returns nothing for a non-admin: the personnel file
    // stays admin-only, so the payroll panel simply does not appear.
    [expenses, salaries] = await Promise.all([
      fetchExpenses(),
      fetchSalaryExpenses(),
    ]);
  } catch {
    // Fallback to empty lists on read failure.
  }

  const can = {
    create: ctxHasPermission(ctx, "expenses.create"),
    edit: ctxHasPermission(ctx, "expenses.edit"),
    delete: ctxHasPermission(ctx, "expenses.delete"),
  };

  return (
    <div>
      <ExpensesManager
        initialExpenses={expenses}
        initialSalaries={salaries}
        currency={await getActiveCurrency()}
        canViewSalaries={ctx.isAdmin}
        can={can}
      />
    </div>
  );
}
