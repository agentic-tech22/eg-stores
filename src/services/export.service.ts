"use server";

import { requireAdmin } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { getErrorMessage } from "@/lib/errors";
import {
  customerColumns,
  flattenInvoiceLines,
  flattenProductVariants,
  flattenSaleLines,
  invoiceColumns,
  invoiceLineColumns,
  productColumns,
  productVariantColumns,
  saleColumns,
  saleLineColumns,
  type CustomerTotals,
} from "@/lib/export/columns";
import { MAX_EXPORT_ROWS, toCsv, type ExportColumn } from "@/lib/export/csv";
import {
  buildExportFilename,
  type ExportDateRange,
} from "@/lib/export/filename";
import { getCategories } from "@/queries/category.query";
import {
  getCustomersForExport,
  getInvoicesForExport,
  getLoyaltyTransactionsForExport,
  getProductsForExport,
  getSalesForExport,
} from "@/queries/export.query";
import { mapSaleRow } from "@/services/sale-engine";
import {
  EXPORT_DATASETS,
  isExportDataset,
  type ExportDataset,
} from "@/types/export.types";

/**
 * Admin-only CSV export. Every dataset goes through one entry point so the
 * authorization check, the row ceiling and the filename convention can't drift
 * apart between them.
 *
 * The CSV is built here and returned as a string, which the client turns into a
 * download. A streaming `/api/exports/...` route would scale further, but it
 * would also sit outside the `(admin)` layout that enforces the session and
 * subscription gates — this keeps the export behind exactly the same door as
 * the rest of the dashboard. `toCsv` is a pure module, so that swap stays cheap
 * if the data ever outgrows this.
 */

export interface ExportRequest {
  dataset: ExportDataset;
  /** Inclusive `YYYY-MM-DD` bounds; omit both for everything. */
  from?: string | null;
  to?: string | null;
}

export interface ExportResult {
  success: boolean;
  error?: string;
  filename?: string;
  csv?: string;
  rowCount?: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate the range, rejecting malformed input rather than passing it to SQL. */
function parseRange(
  from?: string | null,
  to?: string | null,
): ExportDateRange | null {
  if (!from || !to) return null;
  if (!DATE.test(from) || !DATE.test(to)) {
    throw new Error("Invalid date range.");
  }
  // Tolerate a reversed range rather than silently returning nothing.
  return from <= to ? { start: from, end: to } : { start: to, end: from };
}

/** Serialize, enforcing the row ceiling before a huge string is ever built. */
function serialize<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
): { csv: string; rowCount: number } {
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new Error(
      `That range produces ${rows.length.toLocaleString()} rows, over the ${MAX_EXPORT_ROWS.toLocaleString()} limit. Export a shorter period.`,
    );
  }
  return { csv: toCsv(rows, columns), rowCount: rows.length };
}

async function categoryNames(): Promise<Map<string, string>> {
  const categories = await getCategories();
  return new Map(categories.map((c) => [c.id, c.name]));
}

async function buildCsv(
  dataset: ExportDataset,
  range: ExportDateRange | null,
  currencyCode: string,
): Promise<{ csv: string; rowCount: number }> {
  switch (dataset) {
    case "customers": {
      const customers = await getCustomersForExport(range);
      const ledger = await getLoyaltyTransactionsForExport(
        customers.map((c) => c.id),
      );

      // One bulk read rolled up in memory, the way fetchCustomers does it —
      // a per-customer balance query would be N+1.
      const totals = new Map<string, CustomerTotals>();
      for (const entry of ledger) {
        const current = totals.get(entry.customer_id) ?? {
          pointsBalance: 0,
          transactionCount: 0,
        };
        totals.set(entry.customer_id, {
          pointsBalance: current.pointsBalance + entry.points,
          transactionCount: current.transactionCount + 1,
        });
      }

      return serialize(customers, customerColumns(totals));
    }

    case "products": {
      const [{ products, variants }, categoryNameById] = await Promise.all([
        getProductsForExport(range),
        categoryNames(),
      ]);

      const variantStockByProduct = new Map<
        string,
        { total: number; reserved: number }
      >();
      for (const variant of variants) {
        if (variant.archived) continue;
        const current = variantStockByProduct.get(variant.product_id) ?? {
          total: 0,
          reserved: 0,
        };
        variantStockByProduct.set(variant.product_id, {
          total: current.total + variant.stock_quantity,
          reserved: current.reserved + variant.reserved_quantity,
        });
      }

      return serialize(
        products,
        productColumns({
          currencyCode,
          categoryNameById,
          variantStockByProduct,
        }),
      );
    }

    case "product-variants": {
      const [{ products, variants }, categoryNameById] = await Promise.all([
        getProductsForExport(range),
        categoryNames(),
      ]);
      return serialize(
        flattenProductVariants(products, variants),
        productVariantColumns({ currencyCode, categoryNameById }),
      );
    }

    case "sales": {
      const rows = await getSalesForExport(range);
      return serialize(rows.map(mapSaleRow), saleColumns(currencyCode));
    }

    case "sale-items": {
      const rows = await getSalesForExport(range);
      return serialize(
        flattenSaleLines(rows.map(mapSaleRow)),
        saleLineColumns(currencyCode),
      );
    }

    case "invoices": {
      const rows = await getInvoicesForExport(range);
      return serialize(rows, invoiceColumns(currencyCode));
    }

    case "invoice-items": {
      const rows = await getInvoicesForExport(range);
      return serialize(
        flattenInvoiceLines(rows),
        invoiceLineColumns(currencyCode),
      );
    }
  }
}

/**
 * Build one dataset as CSV. Admin-only: the whole point of this screen is bulk
 * egress of the shop's books, which is a different risk class from paging
 * through a table in the UI, so it is not covered by the per-resource `*.view`
 * grants a cashier holds.
 */
export async function exportDataset(
  input: ExportRequest,
): Promise<ExportResult> {
  try {
    await requireAdmin();

    if (!isExportDataset(input.dataset)) {
      return { success: false, error: "Unknown dataset." };
    }

    const range = parseRange(input.from, input.to);
    const currency = await getActiveCurrency();
    const { csv, rowCount } = await buildCsv(
      input.dataset,
      range,
      currency.code,
    );

    const label = EXPORT_DATASETS.find(
      (d) => d.value === input.dataset,
    )!.filenameBase;

    return {
      success: true,
      filename: buildExportFilename(label, range),
      csv,
      rowCount,
    };
  } catch (error) {
    console.error("Export failed:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
