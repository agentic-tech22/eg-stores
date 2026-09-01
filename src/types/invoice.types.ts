export type InvoiceStatus = "issued" | "paid" | "cancelled";

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return INVOICE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** Format a raw counter value into a display number, e.g. ("INV", 1) → "INV-0001". */
export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productTitle: string;
  variantLabel: string | null;
  /** Frozen copy of the sale item's SKU. */
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
  createdAt: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  product_title: string;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  saleId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on detail fetches and list reads (invoice_items are always joined). */
  items?: InvoiceItem[];
}

export interface InvoiceRow {
  id: string;
  sale_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItemRow[];
}

/** How loyalty points accrue per sale. */
export type LoyaltyEarnMode = "percent" | "flat";

/** The shop identity printed on invoices, plus the running invoice counter. */
export interface BusinessProfile {
  shopName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  logoUrl: string | null;
  currency: string;
  invoicePrefix: string;
  invoiceFooter: string | null;
  nextInvoiceNumber: number;
  /** Loyalty program: when enabled, POS sales for phone-identified customers
   * auto-earn points. `percent` grants floor(total * rate / 100); `flat` grants
   * `rate` points per sale. */
  loyaltyEnabled: boolean;
  loyaltyEarnMode: LoyaltyEarnMode;
  loyaltyEarnRate: number;
  updatedAt: string;
}

export interface BusinessProfileRow {
  id: boolean;
  shop_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  logo_url: string | null;
  currency: string;
  invoice_prefix: string;
  invoice_footer: string | null;
  next_invoice_number: number;
  loyalty_enabled: boolean;
  loyalty_earn_mode: LoyaltyEarnMode;
  loyalty_earn_rate: number;
  updated_at: string;
}

/** True when the profile has the minimum info required to issue an invoice. */
export function isBusinessProfileReady(
  profile: BusinessProfile | null,
): boolean {
  return Boolean(profile?.shopName?.trim());
}

/** Fields editable on the business settings form. */
export interface BusinessProfileInput {
  shopName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  logoUrl?: string | null;
  currency: string;
  invoicePrefix: string;
  invoiceFooter?: string | null;
  loyaltyEnabled?: boolean;
  loyaltyEarnMode?: LoyaltyEarnMode;
  loyaltyEarnRate?: number;
}
