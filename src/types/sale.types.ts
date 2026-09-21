import { amountDue, roundMoney, sumPayments } from "@/lib/pos/sale-payment";

export type PaymentMethod =
  | "cash"
  | "esewa"
  | "khalti"
  | "ime_pay"
  | "bank"
  | "credit"
  | "fonepay";

/** Selectable payment methods, in display order. */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "fonepay", label: "Fonepay" },
  { value: "esewa", label: "eSewa" },
  { value: "khalti", label: "Khalti" },
  { value: "ime_pay", label: "IME Pay" },
  { value: "bank", label: "Bank Transfer" },
  { value: "credit", label: "Credit / Due" },
];

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

/**
 * How a sale was made: `shop` at the counter, `online` for storefront orders and
 * anything sold remotely (social, phone) and fulfilled by hand. Orders carry the
 * same union, and a converted sale inherits its order's channel.
 *
 * Distinct from `OrderSource` ('admin'|'storefront'), which records who keyed an
 * order in rather than how it was sold. The two are not interchangeable.
 */
export type SaleChannel = "shop" | "online";

/** Selectable sales channels, in display order. */
export const SALE_CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: "shop", label: "Shop" },
  { value: "online", label: "Online" },
];

export function saleChannelLabel(channel: SaleChannel): string {
  return SALE_CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

/**
 * Payment settlement state, derived from the sale's payment ledger: `pending`
 * when nothing has been collected, `partial` while some of the total is still
 * due, `paid` once the ledger covers it. `failed` is Fonepay-only, set when a
 * QR is rejected or abandoned.
 */
export type PaymentStatus = "pending" | "partial" | "paid" | "failed";

/** Selectable/displayable payment statuses. */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
  failed: "Payment failed",
};

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  productVariantId: string | null;
  productTitle: string;
  variantLabel: string | null;
  /** Snapshot of the effective (variant ?? product) SKU at sale time. */
  sku: string | null;
  quantity: number;
  unitPrice: number;
  /** Snapshot of the product's cost at sale time, for profit calculation. */
  costAtSale: number;
  lineTotal: number;
  createdAt: string;
}

export interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_title: string;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  cost_at_sale: number;
  line_total: number;
  created_at: string;
}

/**
 * An "extra sale": a one-off counter line for something that isn't in the
 * catalog (a service charge, repair labour, a delivery fee). It rides on the
 * same sale as the products — one bill, one payment, one invoice — but is
 * stored in its own table and kept out of every product figure, so catalog
 * profit is never inflated by a line that has no cost to compare against.
 */
export interface ExtraSaleItem {
  id: string;
  saleId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
}

export interface ExtraSaleItemRow {
  id: string;
  sale_id: string;
  title: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

/**
 * One collection against a sale. The counter payment is recorded when the sale
 * is, and each later settlement of the due adds another row, so the ledger
 * answers how much was paid, when, and by which member it was received.
 */
export interface SalePayment {
  id: string;
  saleId: string;
  amount: number;
  /** Date the money changed hands (YYYY-MM-DD). */
  paidOn: string;
  paymentMethod: PaymentMethod;
  note: string | null;
  /** The member who took the money. Null only on backfilled history. */
  receivedBy: string | null;
  receivedByEmail: string | null;
  createdAt: string;
}

export interface SalePaymentRow {
  id: string;
  sale_id: string;
  amount: number;
  paid_on: string;
  payment_method: PaymentMethod;
  note: string | null;
  received_by: string | null;
  received_by_email: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  saleNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  /** Linked customer-directory record (set when recorded with a phone). */
  customerId: string | null;
  paymentMethod: PaymentMethod;
  /** How the sale was made. Converted sales inherit their order's channel. */
  channel: SaleChannel;
  /** Settlement state. 'paid' for everything except in-flight Fonepay QR sales. */
  paymentStatus: PaymentStatus;
  /** Fonepay payment reference number, set only for Fonepay sales. */
  fonepayPrn: string | null;
  /** Fonepay trace id, stored once the payment is confirmed. */
  fonepayTraceId: string | null;
  /** Warehouse this sale deducted stock from. */
  warehouseId: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  saleDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Who recorded the sale (the creator). Null for pre-attribution sales. */
  createdBy: string | null;
  createdByEmail: string | null;
  /** Present on detail fetches and list reads (sale_items are always joined). */
  items?: SaleItem[];
  /** Non-catalog counter lines, joined alongside the items. See `ExtraSaleItem`. */
  extras?: ExtraSaleItem[];
  /** The collection ledger, newest first. Always joined alongside the items. */
  payments?: SalePayment[];
  /** Set when this sale was converted from an order. */
  orderId: string | null;
  /** The source order's number, for display (null for direct sales). */
  orderNumber: number | null;
}

export interface SaleRow {
  id: string;
  sale_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  payment_method: PaymentMethod;
  channel: SaleChannel;
  payment_status: PaymentStatus;
  fonepay_prn: string | null;
  fonepay_trace_id: string | null;
  warehouse_id: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  sale_date: string;
  notes: string | null;
  order_id: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  sale_items?: SaleItemRow[];
  extra_sale_items?: ExtraSaleItemRow[];
  sale_payments?: SalePaymentRow[];
  /** Forward embed of the source order (to-one; null for direct sales). */
  order?: { order_number: number } | null;
}

/**
 * Total collected against a sale, from its payment ledger. A sale fetched
 * without payments reads as 0: callers should use the joined `Sale`, which
 * always carries them.
 */
export function saleAmountPaid(sale: Sale): number {
  return sumPayments(sale.payments ?? []);
}

/** What the customer still owes on a sale (0 once settled). */
export function saleAmountDue(sale: Sale): number {
  return amountDue(sale.total, saleAmountPaid(sale));
}

/** Total catalog units sold. Extra sales are counted by `saleExtrasQuantity`. */
export function saleQuantity(sale: Sale): number {
  return (sale.items ?? []).reduce((sum, it) => sum + it.quantity, 0);
}

/** Total units across the sale's extra (non-catalog) lines. */
export function saleExtrasQuantity(sale: Sale): number {
  return (sale.extras ?? []).reduce((sum, it) => sum + it.quantity, 0);
}

/** True when the sale carries at least one non-catalog line. */
export function saleHasExtras(sale: Sale): boolean {
  return (sale.extras ?? []).length > 0;
}

/**
 * How one sale's money divides between catalog products and extra sales.
 *
 * `sales.subtotal`/`total` cover the whole bill, because that is what the
 * customer paid, but product reporting must see only the catalog side. The
 * discount is the one figure that belongs to neither: it is entered against the
 * sale as a whole, so it is split in proportion to each side's share of the
 * cart. Handing it all to the catalog side instead would let an extras-only
 * sale post a negative product profit against zero product revenue.
 *
 * A sale with no extras gives the whole discount back to the catalog side, so
 * every figure matches what it was before extras existed.
 */
export interface SaleAmountSplit {
  itemsSubtotal: number;
  extrasSubtotal: number;
  itemsDiscount: number;
  extrasDiscount: number;
  /** Subtotal net of that side's share of the discount. */
  itemsRevenue: number;
  extrasRevenue: number;
}

export function saleAmountSplit(sale: Sale): SaleAmountSplit {
  const itemsSubtotal = roundMoney(
    (sale.items ?? []).reduce((sum, it) => sum + it.lineTotal, 0),
  );
  const extrasSubtotal = roundMoney(
    (sale.extras ?? []).reduce((sum, it) => sum + it.lineTotal, 0),
  );
  const gross = itemsSubtotal + extrasSubtotal;
  const discount = sale.discountAmount ?? 0;

  const extrasDiscount =
    gross > 0 && extrasSubtotal > 0
      ? roundMoney(discount * (extrasSubtotal / gross))
      : 0;
  // Take the remainder rather than a second proportion, so the two shares
  // always add back up to the discount exactly.
  const itemsDiscount = roundMoney(discount - extrasDiscount);

  return {
    itemsSubtotal,
    extrasSubtotal,
    itemsDiscount,
    extrasDiscount,
    itemsRevenue: roundMoney(itemsSubtotal - itemsDiscount),
    extrasRevenue: roundMoney(extrasSubtotal - extrasDiscount),
  };
}

/**
 * Product revenue: the catalog side of the bill, net of its share of the
 * discount. This — not `sale.total` — is what every revenue figure in
 * analytics is built from, so extra sales never inflate product performance.
 */
export function saleRevenue(sale: Sale): number {
  return saleAmountSplit(sale).itemsRevenue;
}

/** Revenue from the sale's extra lines, net of their share of the discount. */
export function saleExtrasRevenue(sale: Sale): number {
  return saleAmountSplit(sale).extrasRevenue;
}

/**
 * Profit = sum of (unitPrice - costAtSale) * qty across the CATALOG line items,
 * minus the catalog share of the sale's discount. Extra sales are excluded:
 * they have no cost to margin against, so counting them here would book them as
 * pure profit and distort product P&L.
 */
export function saleProfit(sale: Sale): number {
  const gross = (sale.items ?? []).reduce(
    (sum, it) => sum + (it.unitPrice - it.costAtSale) * it.quantity,
    0,
  );
  return roundMoney(gross - saleAmountSplit(sale).itemsDiscount);
}

/** Short human summary of the line items, e.g. "Headphones ×2, Watch ×1". */
export function saleItemsLabel(sale: Sale): string {
  const parts = [
    ...(sale.items ?? []).map((it) => {
      const name = it.variantLabel
        ? `${it.productTitle} (${it.variantLabel})`
        : it.productTitle;
      return `${name} ×${it.quantity}`;
    }),
    // Extras are part of what was sold at the counter, so they belong in a
    // human summary even though they're excluded from product figures.
    ...(sale.extras ?? []).map((it) => `${it.title} ×${it.quantity}`),
  ];
  if (parts.length === 0) return "N/A";
  return parts.join(", ");
}

/** Short summary of just the extra lines, e.g. "Repair fee ×1". */
export function saleExtrasLabel(sale: Sale): string {
  const extras = sale.extras ?? [];
  if (extras.length === 0) return "";
  return extras.map((it) => `${it.title} ×${it.quantity}`).join(", ");
}

/**
 * A POS line for something that isn't in the catalog. Priced by the cashier, so
 * it holds no stock and has no cost; see `lib/pos/custom-item.ts` for the rules.
 */
export interface CustomSaleLine {
  title: string;
  unitPrice: number;
}

/** One line of a new sale, as submitted from the admin form. */
export interface SaleLineInput {
  /** Catalog product id; empty for a custom line (`custom` is set instead). */
  productId: string;
  productVariantId?: string | null;
  quantity: number;
  /** Set only for custom (non-catalog) lines; `productId` is ignored when present. */
  custom?: CustomSaleLine | null;
}

/** Customer + line items for creating or updating a sale. */
export interface CreateSaleInput {
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod: PaymentMethod;
  /**
   * How the sale was made. Optional so a stale client bundle mid-deploy still
   * records a sale rather than being rejected; the server falls back to 'shop'.
   * An explicitly invalid value is still an error.
   */
  channel?: SaleChannel;
  /** Warehouse to deduct stock from. Defaults to the default warehouse if omitted. */
  warehouseId: string;
  saleDate: string;
  discountAmount?: number;
  notes?: string | null;
  items: SaleLineInput[];
  /**
   * Cash actually collected at the counter. Omitted means the full total. Less
   * than the total leaves a due, which the server only accepts alongside a
   * customer name and phone.
   */
  amountPaid?: number;
}

/** A later collection against an outstanding sale balance. */
export interface RecordSalePaymentInput {
  amount: number;
  /** Date the money changed hands (YYYY-MM-DD). Defaults to today. */
  paidOn?: string;
  paymentMethod?: PaymentMethod;
  note?: string | null;
}
