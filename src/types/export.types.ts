/** The datasets the admin export screen can produce. */
export type ExportDataset =
  | "customers"
  | "products"
  | "product-variants"
  | "sales"
  | "sale-items"
  | "invoices"
  | "invoice-items";

export interface ExportDatasetInfo {
  value: ExportDataset;
  label: string;
  /** One line describing what a row is, shown on the export card. */
  description: string;
  /** Which column the date range filters on, in the user's words. */
  dateBasis: string;
  /** Slug used to name the downloaded file. */
  filenameBase: string;
  /** Groups the cards on the export page. */
  group: "Customers" | "Products" | "Sales" | "Invoices";
}

/**
 * Single source of truth for the export menu: the service names files from it
 * and the page renders its cards from it, so a new dataset is one entry plus
 * one `case` in `buildCsv`.
 */
export const EXPORT_DATASETS: ExportDatasetInfo[] = [
  {
    value: "customers",
    label: "Customers",
    description:
      "One row per customer: contact details, membership, loyalty points balance.",
    dateBasis: "date the customer was added",
    filenameBase: "customers",
    group: "Customers",
  },
  {
    value: "products",
    label: "Products",
    description:
      "One row per product: price, cost, margin, stock, reserved and available.",
    dateBasis: "date the product was added",
    filenameBase: "products",
    group: "Products",
  },
  {
    value: "product-variants",
    label: "Product variants",
    description:
      "One row per variant, with its own SKU, barcode, price and stock levels.",
    dateBasis: "date the parent product was added",
    filenameBase: "product-variants",
    group: "Products",
  },
  {
    value: "sales",
    label: "Sales",
    description:
      "One row per sale: totals, discount, payment method and status, paid, due, product revenue, extra sales, profit.",
    dateBasis: "sale date",
    filenameBase: "sales",
    group: "Sales",
  },
  {
    value: "sale-items",
    label: "Sales — line items",
    description:
      "One row per item sold, products and extra sales alike. Use this to analyse sales by product, SKU or variant; filter the Type column to split the two apart.",
    dateBasis: "sale date",
    filenameBase: "sale-line-items",
    group: "Sales",
  },
  {
    value: "invoices",
    label: "Invoices",
    description:
      "One row per invoice: number, issue and due date, status, customer, totals.",
    dateBasis: "issue date",
    filenameBase: "invoices",
    group: "Invoices",
  },
  {
    value: "invoice-items",
    label: "Invoices — line items",
    description:
      "One row per invoiced item, for reconciling invoices line by line.",
    dateBasis: "issue date",
    filenameBase: "invoice-line-items",
    group: "Invoices",
  },
];

const DATASET_VALUES = new Set<string>(EXPORT_DATASETS.map((d) => d.value));

/** Narrow untrusted input to a known dataset key. */
export function isExportDataset(value: unknown): value is ExportDataset {
  return typeof value === "string" && DATASET_VALUES.has(value);
}
