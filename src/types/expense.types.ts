import type { SalaryRecordType } from "@/types/user-record.types";

/**
 * How an expense was paid. Deliberately the same two-way choice as vendor
 * payments — cash over the counter, or a transfer of some kind — with the exact
 * wallet or bank captured in the entry's Reference field.
 */
export type ExpensePaymentMethod = "cash" | "online";

export const EXPENSE_PAYMENT_METHODS: {
  value: ExpensePaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
];

export function expensePaymentMethodLabel(
  method: ExpensePaymentMethod | null,
): string {
  return method === "online" ? "Online" : "Cash";
}

/** One uploaded receipt (image or PDF) in the public expense-receipts bucket. */
export interface ExpenseAttachment {
  url: string;
  name: string;
  type: string;
}

/**
 * A business operating cost: rent, utilities, transport, repairs, fees. Stock
 * purchases live in the vendor ledger and employee pay in the personnel file;
 * this covers everything else the business spends money on.
 */
export interface Expense {
  id: string;
  title: string;
  /** Free text, e.g. "Rent" or "Electricity". Null when uncategorised. */
  category: string | null;
  amount: number;
  /** The day the money went out, as YYYY-MM-DD. */
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  reference: string | null;
  notes: string | null;
  attachments: ExpenseAttachment[];
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRow {
  id: string;
  title: string;
  category: string | null;
  amount: number;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  reference: string | null;
  notes: string | null;
  attachments: ExpenseAttachment[] | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields accepted when recording or editing an expense. */
export interface ExpenseInput {
  title: string;
  category?: string | null;
  amount: number;
  expenseDate: string;
  paymentMethod?: ExpensePaymentMethod;
  reference?: string | null;
  notes?: string | null;
  attachments?: ExpenseAttachment[];
}

/**
 * One payroll entry flattened for the expense report: a salary record plus the
 * email of the employee it belongs to. Read from `user_salary_records`, never
 * copied into `business_expenses`, so payroll keeps a single home.
 */
export interface SalaryExpense {
  id: string;
  userId: string;
  /** Employee email, or null when the profile row is gone. */
  employeeEmail: string | null;
  type: SalaryRecordType;
  /** Always positive, as stored. The sign is applied by `salaryExpenseDelta`. */
  amount: number;
  /** YYYY-MM-DD, the date the entry applies to. */
  effectiveDate: string;
  note: string | null;
}
