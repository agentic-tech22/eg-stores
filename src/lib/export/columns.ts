import type { CustomerRow } from "@/types/customer.types";
import type { InvoiceItemRow, InvoiceRow } from "@/types/invoice.types";
import { invoiceStatusLabel } from "@/types/invoice.types";
import type { ProductRow, ProductVariantRow } from "@/types/product.types";
import {
  PAYMENT_STATUS_LABELS,
  paymentMethodLabel,
  saleAmountDue,
  saleAmountPaid,
  saleExtrasQuantity,
  saleExtrasRevenue,
  saleProfit,
  saleQuantity,
  saleRevenue,
  type ExtraSaleItem,
  type Sale,
  type SaleItem,
} from "@/types/sale.types";
import type { ExportColumn } from "./csv";
import {
  amount,
  attributes,
  bool,
  isoDate,
  isoDateTime,
  marginPercent,
  money,
  num,
} from "./format";

/**
 * Column definitions for every export dataset.
 *
 * Two shapes are in play, deliberately:
 *
 * - **Sales** are typed on the domain `Sale`, because the real business logic
 *   (amount paid, amount due, profit net of discount) already lives in
 *   `sale.types.ts` and must not be reimplemented here.
 * - **Customers, products and invoices** are typed on their raw `*Row`, because
 *   the only thing a camelCase mapping would add is a copy of a private mapper
 *   from the service layer. There is no derived logic to reuse.
 *
 * These files are for humans reading a spreadsheet: labels are title-case, ids
 * come last (needed for cross-referencing between files, but nobody scans them
 * first), and every money column carries the shop's currency in its header.
 */

// ---------------------------------------------------------------- customers

/** Points balance and entry count per customer, rolled up from the ledger. */
export interface CustomerTotals {
  pointsBalance: number;
  transactionCount: number;
}

export function customerColumns(
  totalsById: Map<string, CustomerTotals>,
): ExportColumn<CustomerRow>[] {
  const totals = (id: string) =>
    totalsById.get(id) ?? { pointsBalance: 0, transactionCount: 0 };

  return [
    { header: "Name", value: (c) => c.name },
    { header: "Phone", value: (c) => c.phone },
    { header: "Email", value: (c) => c.email },
    { header: "Address", value: (c) => c.address },
    { header: "Member", value: (c) => bool(c.is_member) },
    { header: "Active", value: (c) => bool(c.is_active) },
    { header: "Points Balance", value: (c) => num(totals(c.id).pointsBalance) },
    {
      header: "Loyalty Entries",
      value: (c) => num(totals(c.id).transactionCount),
    },
    { header: "Date of Birth", value: (c) => isoDate(c.dob) },
    { header: "Citizenship No.", value: (c) => c.citizenship_number },
    { header: "Notes", value: (c) => c.notes },
    { header: "Created By", value: (c) => c.created_by_email },
    { header: "Created At", value: (c) => isoDateTime(c.created_at) },
    { header: "Customer ID", value: (c) => c.id },
  ];
}

// ----------------------------------------------------------------- products

export function productColumns(opts: {
  currencyCode: string;
  categoryNameById: Map<string, string>;
  /** Summed variant stock per product id, for products that have variants. */
  variantStockByProduct: Map<string, { total: number; reserved: number }>;
}): ExportColumn<ProductRow>[] {
  const { currencyCode, categoryNameById, variantStockByProduct } = opts;

  // A product with variants holds no stock of its own — the parent row's
  // counters stay at zero and the truth is the sum across its variants.
  const stockOf = (p: ProductRow) =>
    p.has_variants
      ? (variantStockByProduct.get(p.id) ?? { total: 0, reserved: 0 })
      : { total: p.stock_quantity, reserved: p.reserved_quantity };

  return [
    { header: "Title", value: (p) => p.title },
    { header: "SKU", value: (p) => p.sku },
    { header: "Barcode", value: (p) => p.barcode },
    {
      header: "Category",
      value: (p) =>
        p.category_id ? (categoryNameById.get(p.category_id) ?? "") : "",
    },
    { header: money("Price", currencyCode), value: (p) => amount(p.price) },
    {
      header: money("Cost Price", currencyCode),
      value: (p) => amount(p.cost_price),
    },
    { header: "Margin %", value: (p) => marginPercent(p.price, p.cost_price) },
    { header: "Stock", value: (p) => num(stockOf(p).total) },
    { header: "Reserved", value: (p) => num(stockOf(p).reserved) },
    {
      header: "Available",
      value: (p) => num(stockOf(p).total - stockOf(p).reserved),
    },
    {
      header: money("Stock Value at Cost", currencyCode),
      value: (p) => amount(stockOf(p).total * p.cost_price),
    },
    { header: "Has Variants", value: (p) => bool(p.has_variants) },
    { header: "Visible", value: (p) => bool(p.is_visible) },
    { header: "Featured", value: (p) => bool(p.is_featured) },
    { header: "Description", value: (p) => p.description },
    { header: "Created At", value: (p) => isoDateTime(p.created_at) },
    { header: "Product ID", value: (p) => p.id },
  ];
}

// --------------------------------------------------------- product variants

/** One sellable unit: a variant together with the product it belongs to. */
export interface ProductVariantLine {
  product: ProductRow;
  variant: ProductVariantRow;
}

/**
 * One row per variant. CSV is a single table, so variants get their own file
 * rather than being folded into the product export.
 */
export function flattenProductVariants(
  products: readonly ProductRow[],
  variants: readonly ProductVariantRow[],
): ProductVariantLine[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const lines: ProductVariantLine[] = [];

  for (const variant of variants) {
    const product = productById.get(variant.product_id);
    if (product) lines.push({ product, variant });
  }
  return lines;
}

export function productVariantColumns(opts: {
  currencyCode: string;
  categoryNameById: Map<string, string>;
}): ExportColumn<ProductVariantLine>[] {
  const { currencyCode, categoryNameById } = opts;

  return [
    { header: "Product", value: (l) => l.product.title },
    { header: "Product SKU", value: (l) => l.product.sku },
    {
      header: "Category",
      value: (l) =>
        l.product.category_id
          ? (categoryNameById.get(l.product.category_id) ?? "")
          : "",
    },
    { header: "Variant", value: (l) => l.variant.display_name },
    { header: "Attributes", value: (l) => attributes(l.variant.attributes) },
    { header: "Variant SKU", value: (l) => l.variant.sku },
    { header: "Variant Barcode", value: (l) => l.variant.barcode },
    {
      // A variant without an override inherits the parent's price.
      header: money("Price", currencyCode),
      value: (l) => amount(l.variant.price_override ?? l.product.price),
    },
    {
      header: money("Cost Price", currencyCode),
      value: (l) => amount(l.product.cost_price),
    },
    { header: "Stock", value: (l) => num(l.variant.stock_quantity) },
    { header: "Reserved", value: (l) => num(l.variant.reserved_quantity) },
    {
      header: "Available",
      value: (l) => num(l.variant.stock_quantity - l.variant.reserved_quantity),
    },
    { header: "Archived", value: (l) => bool(l.variant.archived) },
    { header: "Created At", value: (l) => isoDateTime(l.variant.created_at) },
    { header: "Product ID", value: (l) => l.product.id },
    { header: "Variant ID", value: (l) => l.variant.id },
  ];
}

// -------------------------------------------------------------------- sales

/** Catalog line summary, e.g. `Headphones ×2, Watch ×1`. Empty for no items. */
function itemsSummary(sale: Sale): string {
  const items = sale.items ?? [];
  // Not `saleItemsLabel()` from sale.types: it returns the literal "N/A" for an
  // empty sale, which would be a lie in a data file, and it folds the extra
  // lines in, which this file keeps in their own column.
  return items
    .map((it) => {
      const name = it.variantLabel
        ? `${it.productTitle} (${it.variantLabel})`
        : it.productTitle;
      return `${name} ×${it.quantity}`;
    })
    .join(", ");
}

/** Extra (non-catalog) line summary, e.g. `Repair fee ×1`. */
function extrasSummary(sale: Sale): string {
  return (sale.extras ?? [])
    .map((it) => `${it.title} ×${it.quantity}`)
    .join(", ");
}

export function saleColumns(currencyCode: string): ExportColumn<Sale>[] {
  return [
    { header: "Sale #", value: (s) => s.saleNumber },
    { header: "Date", value: (s) => isoDate(s.saleDate) },
    { header: "Customer Name", value: (s) => s.customerName },
    { header: "Customer Phone", value: (s) => s.customerPhone },
    { header: "Items", value: (s) => itemsSummary(s) },
    { header: "Units", value: (s) => num(saleQuantity(s)) },
    { header: "Extra Items", value: (s) => extrasSummary(s) },
    { header: "Extra Units", value: (s) => num(saleExtrasQuantity(s)) },
    {
      header: "Payment Method",
      value: (s) => paymentMethodLabel(s.paymentMethod),
    },
    {
      header: "Payment Status",
      value: (s) => PAYMENT_STATUS_LABELS[s.paymentStatus] ?? s.paymentStatus,
    },
    {
      header: money("Subtotal", currencyCode),
      value: (s) => amount(s.subtotal),
    },
    {
      header: money("Discount", currencyCode),
      value: (s) => amount(s.discountAmount),
    },
    { header: money("Total", currencyCode), value: (s) => amount(s.total) },
    // Total split by side, each already net of its share of the discount, so
    // Product Revenue + Extra Sales reconciles back to Total.
    {
      header: money("Product Revenue", currencyCode),
      value: (s) => amount(saleRevenue(s)),
    },
    {
      header: money("Extra Sales", currencyCode),
      value: (s) => amount(saleExtrasRevenue(s)),
    },
    {
      header: money("Amount Paid", currencyCode),
      value: (s) => amount(saleAmountPaid(s)),
    },
    {
      header: money("Amount Due", currencyCode),
      value: (s) => amount(saleAmountDue(s)),
    },
    {
      // Product profit only: extra sales carry no cost, so counting them here
      // would book them as pure margin. They sit in Extra Sales above instead.
      header: money("Profit", currencyCode),
      value: (s) => amount(saleProfit(s)),
    },
    { header: "Order #", value: (s) => s.orderNumber },
    { header: "Recorded By", value: (s) => s.createdByEmail },
    { header: "Notes", value: (s) => s.notes },
    { header: "Recorded At", value: (s) => isoDateTime(s.createdAt) },
    { header: "Sale ID", value: (s) => s.id },
  ];
}

/**
 * A single sale line. Exactly one of `item` / `extra` is set, and both are null
 * on the placeholder row emitted for a sale that has no lines at all.
 */
export interface SaleLine {
  sale: Sale;
  item: SaleItem | null;
  /** Set on an extra-sale line (a non-catalog counter charge). */
  extra: ExtraSaleItem | null;
  lineNumber: number;
}

/**
 * One row per line: the catalog items first, then the extra (non-catalog)
 * lines, numbered continuously so the file reads as one bill. A sale with no
 * lines of either kind still emits one placeholder row, so no sale silently
 * disappears from the file when it is reconciled against the summary export.
 */
export function flattenSaleLines(sales: readonly Sale[]): SaleLine[] {
  const lines: SaleLine[] = [];

  for (const sale of sales) {
    const items = sale.items ?? [];
    const extras = sale.extras ?? [];
    if (items.length === 0 && extras.length === 0) {
      lines.push({ sale, item: null, extra: null, lineNumber: 0 });
      continue;
    }
    items.forEach((item, i) =>
      lines.push({ sale, item, extra: null, lineNumber: i + 1 }),
    );
    extras.forEach((extra, i) =>
      lines.push({
        sale,
        item: null,
        extra,
        lineNumber: items.length + i + 1,
      }),
    );
  }
  return lines;
}

/**
 * Per-line columns. Line Profit is gross — it does NOT subtract the sale-level
 * discount, which belongs to the sale and not to any one line. The summary
 * export's Profit column is the authoritative figure for a discounted sale.
 *
 * Extra-sale rows leave Unit Cost and Line Profit blank rather than writing 0.
 * A zero cost would read as a measured cost and make the line look like pure
 * margin, which is exactly the distortion these lines were separated to avoid;
 * blank says "not a product figure". Filter on the Type column to split the
 * file into product lines and extra sales.
 */
export function saleLineColumns(
  currencyCode: string,
): ExportColumn<SaleLine>[] {
  return [
    { header: "Sale #", value: (l) => l.sale.saleNumber },
    { header: "Date", value: (l) => isoDate(l.sale.saleDate) },
    { header: "Line #", value: (l) => num(l.lineNumber) },
    {
      header: "Type",
      value: (l) => (l.item ? "Product" : l.extra ? "Extra sale" : ""),
    },
    {
      header: "Product",
      value: (l) => l.item?.productTitle ?? l.extra?.title ?? "",
    },
    { header: "Variant", value: (l) => l.item?.variantLabel ?? "" },
    { header: "SKU", value: (l) => l.item?.sku ?? "" },
    {
      header: "Quantity",
      value: (l) => {
        const qty = l.item?.quantity ?? l.extra?.quantity;
        return qty === undefined ? "" : num(qty);
      },
    },
    {
      header: money("Unit Price", currencyCode),
      value: (l) => {
        const price = l.item?.unitPrice ?? l.extra?.unitPrice;
        return price === undefined ? "" : amount(price);
      },
    },
    {
      header: money("Unit Cost", currencyCode),
      value: (l) => (l.item ? amount(l.item.costAtSale) : ""),
    },
    {
      header: money("Line Total", currencyCode),
      value: (l) => {
        const total = l.item?.lineTotal ?? l.extra?.lineTotal;
        return total === undefined ? "" : amount(total);
      },
    },
    {
      header: money("Line Profit", currencyCode),
      value: (l) =>
        l.item
          ? amount((l.item.unitPrice - l.item.costAtSale) * l.item.quantity)
          : "",
    },
    { header: "Customer Name", value: (l) => l.sale.customerName },
    { header: "Customer Phone", value: (l) => l.sale.customerPhone },
    {
      header: "Payment Method",
      value: (l) => paymentMethodLabel(l.sale.paymentMethod),
    },
    {
      header: "Payment Status",
      value: (l) =>
        PAYMENT_STATUS_LABELS[l.sale.paymentStatus] ?? l.sale.paymentStatus,
    },
    { header: "Recorded By", value: (l) => l.sale.createdByEmail },
    { header: "Sale ID", value: (l) => l.sale.id },
    { header: "Sale Item ID", value: (l) => l.item?.id ?? l.extra?.id ?? "" },
  ];
}

// ----------------------------------------------------------------- invoices

const invoiceItems = (inv: InvoiceRow): InvoiceItemRow[] =>
  inv.invoice_items ?? [];

export function invoiceColumns(
  currencyCode: string,
): ExportColumn<InvoiceRow>[] {
  return [
    { header: "Invoice #", value: (i) => i.invoice_number },
    { header: "Issue Date", value: (i) => isoDate(i.issue_date) },
    { header: "Due Date", value: (i) => isoDate(i.due_date) },
    { header: "Status", value: (i) => invoiceStatusLabel(i.status) },
    { header: "Customer Name", value: (i) => i.customer_name },
    { header: "Customer Phone", value: (i) => i.customer_phone },
    { header: "Line Count", value: (i) => num(invoiceItems(i).length) },
    {
      header: "Units",
      value: (i) =>
        num(invoiceItems(i).reduce((sum, it) => sum + it.quantity, 0)),
    },
    {
      header: money("Subtotal", currencyCode),
      value: (i) => amount(i.subtotal),
    },
    {
      header: money("Discount", currencyCode),
      value: (i) => amount(i.discount_amount),
    },
    {
      header: money("Total", currencyCode),
      value: (i) => amount(i.total_amount),
    },
    { header: "Notes", value: (i) => i.notes },
    { header: "Created At", value: (i) => isoDateTime(i.created_at) },
    { header: "Invoice ID", value: (i) => i.id },
    { header: "Sale ID", value: (i) => i.sale_id },
  ];
}

/** A single invoice line. `item` is null for an invoice with no line items. */
export interface InvoiceLine {
  invoice: InvoiceRow;
  item: InvoiceItemRow | null;
  lineNumber: number;
}

/** One row per invoice item, with the same placeholder rule as sale lines. */
export function flattenInvoiceLines(
  invoices: readonly InvoiceRow[],
): InvoiceLine[] {
  const lines: InvoiceLine[] = [];

  for (const invoice of invoices) {
    const items = [...invoiceItems(invoice)].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    if (items.length === 0) {
      lines.push({ invoice, item: null, lineNumber: 0 });
      continue;
    }
    items.forEach((item, i) =>
      lines.push({ invoice, item, lineNumber: i + 1 }),
    );
  }
  return lines;
}

export function invoiceLineColumns(
  currencyCode: string,
): ExportColumn<InvoiceLine>[] {
  return [
    { header: "Invoice #", value: (l) => l.invoice.invoice_number },
    { header: "Issue Date", value: (l) => isoDate(l.invoice.issue_date) },
    { header: "Status", value: (l) => invoiceStatusLabel(l.invoice.status) },
    { header: "Line #", value: (l) => num(l.lineNumber) },
    { header: "Product", value: (l) => l.item?.product_title ?? "" },
    { header: "Variant", value: (l) => l.item?.variant_label ?? "" },
    { header: "SKU", value: (l) => l.item?.sku ?? "" },
    { header: "Quantity", value: (l) => (l.item ? num(l.item.quantity) : "") },
    {
      header: money("Unit Price", currencyCode),
      value: (l) => (l.item ? amount(l.item.unit_price) : ""),
    },
    {
      header: money("Line Total", currencyCode),
      value: (l) => (l.item ? amount(l.item.line_total) : ""),
    },
    { header: "Customer Name", value: (l) => l.invoice.customer_name },
    { header: "Invoice ID", value: (l) => l.invoice.id },
    { header: "Invoice Item ID", value: (l) => l.item?.id ?? "" },
  ];
}
