/**
 * Customer mappers + loyalty helpers: pure functions shared by the customer
 * service (and the sale service, for auto-earning). NOT a "use server" module,
 * so it can export plain (non-async) functions.
 */

import type { BusinessProfile } from "@/types/invoice.types";
import type {
  Customer,
  CustomerRow,
  CustomerWithBalance,
  LoyaltyTransaction,
  LoyaltyTransactionRow,
} from "@/types/customer.types";

export function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    // Rows written before the column existed come back undefined, so coerce.
    isMember: row.is_member ?? false,
    // Also undefined on rows written before the membership columns existed.
    dob: row.dob ?? null,
    citizenshipNumber: row.citizenship_number ?? null,
    citizenshipPhotoPath: row.citizenship_photo_path ?? null,
    sortOrder: row.sort_order,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLoyaltyTransactionRow(
  row: LoyaltyTransactionRow,
): LoyaltyTransaction {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    points: row.points ?? 0,
    txnDate: row.txn_date,
    saleId: row.sale_id,
    note: row.note,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

/**
 * A customer's loyalty balance: the signed sum of every ledger row. Earn and
 * adjust-credit rows are stored positive, redeem and adjust-debit negative, so
 * the balance is a plain sum (mirrors the vendor payable derivation).
 */
export function computeLoyaltyBalance(
  transactions: Pick<LoyaltyTransactionRow, "points">[],
): number {
  return transactions.reduce((balance, txn) => balance + (txn.points ?? 0), 0);
}

/** Attach the derived points balance + transaction count to a customer. */
export function toCustomerWithBalance(
  customer: Customer,
  transactions: Pick<LoyaltyTransactionRow, "points">[],
): CustomerWithBalance {
  return {
    ...customer,
    pointsBalance: computeLoyaltyBalance(transactions),
    transactionCount: transactions.length,
  };
}

/**
 * Points a sale of `saleTotal` earns under the current program config. Returns
 * 0 when loyalty is disabled. `percent` mode grants floor(total * rate / 100);
 * `flat` mode grants `rate` points per sale regardless of total.
 */
export function computeEarnedPoints(
  profile: Pick<
    BusinessProfile,
    "loyaltyEnabled" | "loyaltyEarnMode" | "loyaltyEarnRate"
  > | null,
  saleTotal: number,
): number {
  if (!profile?.loyaltyEnabled) return 0;
  const rate = profile.loyaltyEarnRate ?? 0;
  if (rate <= 0) return 0;
  if (profile.loyaltyEarnMode === "flat") return Math.round(rate);
  return Math.floor((saleTotal * rate) / 100);
}
