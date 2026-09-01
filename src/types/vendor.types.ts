import { paymentMethodLabel, type PaymentMethod } from "@/types/sale.types";

/** A ledger row is either a bill received or a payment made. */
export type VendorTransactionType = "bill" | "payment";

export const VENDOR_TRANSACTION_TYPES: {
  value: VendorTransactionType;
  label: string;
}[] = [
  { value: "bill", label: "Bill" },
  { value: "payment", label: "Payment" },
];

/**
 * Per-bill settlement state (payments leave this null). A "paid" bill was
 * settled when it was recorded, so it never reaches the outstanding payable.
 */
export type VendorBillStatus = "unpaid" | "paid";

export const VENDOR_BILL_STATUS_LABELS: Record<VendorBillStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
};

/**
 * How a payment to a vendor was made. Paying a supplier is a two-way choice in
 * practice — cash over the counter, or a transfer of some kind — so this is
 * deliberately NOT the POS `PaymentMethod` list: which wallet or bank moved the
 * money is captured in the payment's Reference field instead.
 */
export type VendorPaymentMethod = "cash" | "online";

export const VENDOR_PAYMENT_METHODS: {
  value: VendorPaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
];

/**
 * What the `payment_method` column can actually hold. New entries are always a
 * `VendorPaymentMethod`, but rows written before the list was narrowed can
 * still carry any of the POS methods, so reads must tolerate them.
 */
export type VendorStoredPaymentMethod = VendorPaymentMethod | PaymentMethod;

/** Display label, including for the legacy POS methods on older rows. */
export function vendorPaymentMethodLabel(
  method: VendorStoredPaymentMethod,
): string {
  if (method === "online") return "Online";
  return paymentMethodLabel(method);
}

/**
 * Narrow a stored value to the two options the form offers, so editing an old
 * entry opens on something valid. An eSewa, Khalti, IME, bank or Fonepay entry
 * reads as "online" — which is what all of those were. Null (an unrecorded
 * method, or a brand-new payment) falls back to cash, the common case.
 */
export function toVendorPaymentMethod(
  method: VendorStoredPaymentMethod | null | undefined,
): VendorPaymentMethod {
  if (!method) return "cash";
  return method === "cash" ? "cash" : "online";
}

/** One uploaded bill attachment (image or PDF) in the public vendor-bills bucket. */
export interface VendorAttachment {
  url: string;
  name: string;
  type: string;
}

/** A supplier the business buys from. */
export interface Vendor {
  id: string;
  name: string;
  /** Short human code (e.g. "ACME"); null when unset. */
  code: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Nepal PAN number (non-VAT vendors). */
  panNumber: string | null;
  /** Nepal VAT registration number (VAT-registered vendors). */
  vatNumber: string | null;
  /** Payable owed at onboarding, carried into the computed balance. */
  openingBalance: number;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRow {
  id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  pan_number: string | null;
  vat_number: string | null;
  opening_balance: number;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

/** One bill or payment against a vendor. */
export interface VendorTransaction {
  id: string;
  vendorId: string;
  type: VendorTransactionType;
  txnDate: string;
  billNumber: string | null;
  reference: string | null;
  subtotal: number;
  taxAmount: number;
  amount: number;
  /** Null on bills. May be a legacy POS method on rows written before the
   * vendor list was narrowed to cash/online. */
  paymentMethod: VendorStoredPaymentMethod | null;
  status: VendorBillStatus | null;
  /** The date a bill was settled (YYYY-MM-DD); null while unpaid. */
  paidAt: string | null;
  attachments: VendorAttachment[];
  notes: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorTransactionRow {
  id: string;
  vendor_id: string;
  type: VendorTransactionType;
  txn_date: string;
  bill_number: string | null;
  reference: string | null;
  subtotal: number;
  tax_amount: number;
  amount: number;
  payment_method: VendorStoredPaymentMethod | null;
  status: VendorBillStatus | null;
  paid_at: string | null;
  attachments: VendorAttachment[] | null;
  notes: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

/** A single bill's amount + date, for date-range purchase reporting. */
export interface VendorPurchase {
  vendorId: string;
  amount: number;
  txnDate: string;
}

/** A vendor plus its derived payable balance, for list/summary views. */
export interface VendorWithBalance extends Vendor {
  /** opening_balance + Σ(bills.amount) − Σ(payments.amount). */
  outstanding: number;
  /** Number of ledger rows recorded against this vendor. */
  transactionCount: number;
}

/** Fields accepted when creating/editing a vendor. */
export interface VendorInput {
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  panNumber?: string | null;
  vatNumber?: string | null;
  openingBalance?: number;
  notes?: string | null;
  isActive?: boolean;
}

/** Fields accepted when recording a bill or payment. */
export interface VendorTransactionInput {
  vendorId: string;
  type: VendorTransactionType;
  txnDate: string;
  billNumber?: string | null;
  reference?: string | null;
  subtotal?: number;
  taxAmount?: number;
  amount: number;
  /** New entries only ever record one of the two current options. */
  paymentMethod?: VendorPaymentMethod | null;
  status?: VendorBillStatus | null;
  /** Settlement date for a paid bill; defaults to the bill date when omitted. */
  paidAt?: string | null;
  attachments?: VendorAttachment[];
  notes?: string | null;
}
