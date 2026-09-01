/**
 * Partial payments and due tracking for sales.
 *
 * A sale's collected amount is the sum of its `sale_payments` ledger, never a
 * stored field. Anything short of the total is a due the customer still owes,
 * which is why a short payment requires an identified customer: an anonymous
 * walk-in leaves nobody to collect from.
 *
 * These rules run in the POS form (to reject before a sale is written) and again
 * in the sale service (the authoritative check).
 */

import type { PaymentStatus } from "@/types/sale.types";

/** Money is stored as NUMERIC(10,2); a single payment can't exceed that. */
export const PAYMENT_AMOUNT_MAX = 99_999_999.99;

/**
 * Tolerance for float comparisons, at half the smallest stored unit. Amounts
 * round-trip through NUMERIC(10,2), so `paid >= total` must not hinge on a
 * 0.00000001 rounding artifact.
 */
const EPSILON = 0.005;

/** Round to the 2 decimals the money columns store. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Parse a form string or raw number, rejecting blanks and non-numeric input. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Total collected so far across a sale's payment ledger. */
export function sumPayments(payments: { amount: number }[]): number {
  return roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
}

/** What's still owed on a sale. Never negative, even if overpaid. */
export function amountDue(total: number, paid: number): number {
  return Math.max(0, roundMoney(total - paid));
}

/**
 * Settlement state implied by the ledger. `failed` is Fonepay-only and set by
 * that flow directly, so it is never produced here.
 */
export function paymentStatusFor(total: number, paid: number): PaymentStatus {
  if (paid >= total - EPSILON) return "paid";
  if (paid > EPSILON) return "partial";
  return "pending";
}

/** True when the collected amount leaves money owed on the sale. */
export function leavesDue(total: number, paid: number): boolean {
  return paid < total - EPSILON;
}

/**
 * A sale short-paid on credit must name someone to collect from. Both a name
 * and a phone are required: the phone is the customer directory's identity key,
 * the name is what makes a due list readable.
 */
export function hasCustomerIdentity(customer: {
  name?: string | null;
  phone?: string | null;
}): boolean {
  const digits = (customer.phone ?? "").replace(/\D/g, "");
  return Boolean((customer.name ?? "").trim()) && digits.length >= 10;
}

/** Message shown when a short payment is rejected for lacking a customer. */
export const CUSTOMER_REQUIRED_TITLE = "Customer details required";
export const CUSTOMER_REQUIRED_MESSAGE =
  "This sale leaves an amount due, so it has to be traceable to a customer. Enter the customer's name and phone number (at least 10 digits), or collect the full amount.";

export interface PaymentDraft {
  amount: string | number;
  /** ISO date (YYYY-MM-DD) the money changed hands. */
  paidOn?: string;
}

export interface PaymentErrors {
  amount?: string;
  paidOn?: string;
}

export interface PaymentValue {
  amount: number;
  paidOn: string;
}

/**
 * Validate one collection against the outstanding balance. `maxAmount` is the
 * remaining due, so a payment can never overshoot what is owed: an overpayment
 * is a refund, which this ledger deliberately doesn't model.
 */
export function validatePayment(
  draft: PaymentDraft,
  maxAmount: number,
): { errors: PaymentErrors; value: PaymentValue | null } {
  const errors: PaymentErrors = {};

  const parsed = toNumber(draft?.amount);
  const amount = parsed === null ? null : roundMoney(parsed);
  const limit = roundMoney(maxAmount);

  if (amount === null) {
    errors.amount = "Enter an amount.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than 0.";
  } else if (amount > PAYMENT_AMOUNT_MAX) {
    errors.amount = "Amount is too large.";
  } else if (limit <= 0) {
    errors.amount = "This sale is already fully paid.";
  } else if (amount > limit + EPSILON) {
    errors.amount = `Amount can't exceed the ${limit.toFixed(2)} still due.`;
  }

  // Default to today rather than rejecting a blank: the field is prefilled in
  // every UI, so an empty value means the caller simply didn't supply one.
  const paidOn = (draft?.paidOn ?? "").trim() || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(paidOn))) {
    errors.paidOn = "Choose a valid date.";
  }

  if (Object.keys(errors).length > 0) return { errors, value: null };
  return { errors, value: { amount: amount as number, paidOn } };
}

/** Today in local time as YYYY-MM-DD (matches how sale dates are entered). */
function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
