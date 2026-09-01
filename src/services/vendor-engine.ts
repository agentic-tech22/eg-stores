/**
 * Vendor mappers + balance helpers: pure functions shared by the vendor
 * service. NOT a "use server" module, so it can export plain (non-async)
 * functions.
 */

import type {
  Vendor,
  VendorRow,
  VendorTransaction,
  VendorTransactionRow,
  VendorWithBalance,
} from "@/types/vendor.types";

export function mapVendorRow(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    panNumber: row.pan_number,
    vatNumber: row.vat_number,
    openingBalance: row.opening_balance ?? 0,
    notes: row.notes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVendorTransactionRow(
  row: VendorTransactionRow,
): VendorTransaction {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    type: row.type,
    txnDate: row.txn_date,
    billNumber: row.bill_number,
    reference: row.reference,
    subtotal: row.subtotal ?? 0,
    taxAmount: row.tax_amount ?? 0,
    amount: row.amount ?? 0,
    paymentMethod: row.payment_method,
    status: row.status,
    paidAt: row.paid_at,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    notes: row.notes,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The ledger fields a balance calculation needs from a bill or payment. */
export type BalanceEntry = Pick<
  VendorTransactionRow,
  "type" | "amount" | "status"
>;

/**
 * A bill that was already settled ("paid") never creates a separate payment row,
 * so it must not weigh on the payable. An unpaid bill counts in full; anything
 * paid off in instalments is recorded as its own payment entries instead.
 */
export function isBillOutstanding(entry: Pick<BalanceEntry, "status">): boolean {
  return entry.status !== "paid";
}

/**
 * How one ledger row moves the payable: an outstanding bill increases it, a
 * payment reduces it, and a settled bill leaves it untouched.
 */
export function balanceDelta(entry: BalanceEntry): number {
  const amount = entry.amount ?? 0;
  if (entry.type === "payment") return -amount;
  return isBillOutstanding(entry) ? amount : 0;
}

/**
 * The payable owed to a vendor: opening balance plus the sum of unsettled bills,
 * minus the sum of payments. A positive figure is what the business still owes.
 */
export function computeVendorBalance(
  openingBalance: number,
  transactions: BalanceEntry[],
): number {
  return transactions.reduce(
    (balance, txn) => balance + balanceDelta(txn),
    openingBalance ?? 0,
  );
}

export interface PayableDisplay {
  /** True when the balance is negative: the vendor holds our prepaid money. */
  isCredit: boolean;
  /** Non-negative magnitude to display. */
  amount: number;
  /** "Payable" when we owe, "Advance / Credit" when overpaid. */
  label: string;
}

/**
 * Interpret a signed outstanding balance for display. Positive = we owe the
 * vendor (a payable); negative = we overpaid / hold an advance (a credit), shown
 * as a positive "Advance / Credit" rather than a confusing negative payable.
 */
export function describePayable(outstanding: number): PayableDisplay {
  if (outstanding < 0) {
    return { isCredit: true, amount: -outstanding, label: "Advance / Credit" };
  }
  return { isCredit: false, amount: outstanding, label: "Payable" };
}

/** Attach the derived outstanding balance + transaction count to a vendor. */
export function toVendorWithBalance(
  vendor: Vendor,
  transactions: BalanceEntry[],
): VendorWithBalance {
  return {
    ...vendor,
    outstanding: computeVendorBalance(vendor.openingBalance, transactions),
    transactionCount: transactions.length,
  };
}
