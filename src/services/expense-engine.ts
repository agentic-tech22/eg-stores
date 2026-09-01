/**
 * Expense mappers + totalling helpers: pure functions shared by the expense
 * service and the dashboard client. NOT a "use server" module, so it can export
 * plain (non-async) functions and be unit-tested directly.
 */

import type {
  Expense,
  ExpenseRow,
  SalaryExpense,
} from "@/types/expense.types";
import type { SalaryRecordType } from "@/types/user-record.types";

export function mapExpenseRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount ?? 0),
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method ?? "cash",
    reference: row.reference,
    notes: row.notes,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------------------------------------------------------------------------
 * Payroll
 * ------------------------------------------------------------------------- */

/**
 * How one salary record moves the payroll cost for its period.
 *
 * Amounts are stored positive in `user_salary_records`; the sign lives here.
 *  - salary, bonus, advance — money that left the business, so they add.
 *  - deduction — withheld from pay, so it subtracts.
 *  - raise — a change to the pay RATE, not a payment. Counting it would inflate
 *    payroll by the new salary figure on top of the salary entries themselves,
 *    so it contributes nothing.
 */
export function salaryExpenseDelta(entry: {
  type: SalaryRecordType;
  amount: number;
}): number {
  const amount = Number(entry.amount ?? 0);
  switch (entry.type) {
    case "raise":
      return 0;
    case "deduction":
      return -amount;
    default:
      return amount;
  }
}

/** True when a salary record affects the payroll total at all. */
export function isPayrollEntry(type: SalaryRecordType): boolean {
  return type !== "raise";
}

/** Net payroll cost across a set of salary records. */
export function totalSalaryExpense(
  entries: Pick<SalaryExpense, "type" | "amount">[],
): number {
  return entries.reduce((sum, e) => sum + salaryExpenseDelta(e), 0);
}

/* ---------------------------------------------------------------------------
 * Date filtering + totals
 * ------------------------------------------------------------------------- */

/** Inclusive YYYY-MM-DD bounds; null means unbounded on that side. */
export interface ExpenseRange {
  from: string | null;
  to: string | null;
}

/** True when a YYYY-MM-DD date sits inside the (inclusive) range. */
export function isInRange(date: string, range: ExpenseRange): boolean {
  const day = date.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

/** Keep only the rows whose `dateKey` value falls inside the range. */
export function filterByRange<T>(
  rows: T[],
  range: ExpenseRange,
  dateOf: (row: T) => string,
): T[] {
  return rows.filter((row) => isInRange(dateOf(row), range));
}

/** Plain sum of expense amounts. */
export function totalExpenses(entries: Pick<Expense, "amount">[]): number {
  return entries.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
}

/** The label an uncategorised expense is grouped under. */
export const UNCATEGORISED = "Uncategorised";

/**
 * Totals per category, biggest first. Categories are free text, so they are
 * trimmed and compared case-insensitively — "rent" and "Rent" are one line —
 * while the first spelling seen is kept for display.
 */
export function byCategory(
  entries: Pick<Expense, "category" | "amount">[],
): { category: string; total: number; count: number }[] {
  const groups = new Map<string, { category: string; total: number; count: number }>();
  for (const entry of entries) {
    const label = entry.category?.trim() || UNCATEGORISED;
    const key = label.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.total += Number(entry.amount ?? 0);
      existing.count += 1;
    } else {
      groups.set(key, {
        category: label,
        total: Number(entry.amount ?? 0),
        count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

/** Distinct category labels already in use, for the form's suggestion list. */
export function knownCategories(
  entries: Pick<Expense, "category">[],
): string[] {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const label = entry.category?.trim();
    if (label && !seen.has(label.toLowerCase())) {
      seen.set(label.toLowerCase(), label);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

/** Net payroll per employee, biggest first; entries without a profile group last. */
export function bySalaryEmployee(
  entries: SalaryExpense[],
): { employeeEmail: string; total: number; count: number }[] {
  const groups = new Map<string, { employeeEmail: string; total: number; count: number }>();
  for (const entry of entries) {
    if (!isPayrollEntry(entry.type)) continue;
    const key = entry.employeeEmail ?? "Unknown employee";
    const existing = groups.get(key);
    const delta = salaryExpenseDelta(entry);
    if (existing) {
      existing.total += delta;
      existing.count += 1;
    } else {
      groups.set(key, { employeeEmail: key, total: delta, count: 1 });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

/** The headline figures for a period: payroll, other costs, and their sum. */
export interface ExpenseSummary {
  salaryTotal: number;
  expenseTotal: number;
  grandTotal: number;
  expenseCount: number;
}

export function summarize(
  expenses: Pick<Expense, "amount">[],
  salaries: Pick<SalaryExpense, "type" | "amount">[],
): ExpenseSummary {
  const salaryTotal = totalSalaryExpense(salaries);
  const expenseTotal = totalExpenses(expenses);
  return {
    salaryTotal,
    expenseTotal,
    grandTotal: salaryTotal + expenseTotal,
    expenseCount: expenses.length,
  };
}
