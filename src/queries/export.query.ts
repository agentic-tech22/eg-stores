import { createAdminClient } from "@/lib/supabase/server";
import type { ExportDateRange } from "@/lib/export/filename";
import type {
  CustomerRow,
  LoyaltyTransactionRow,
} from "@/types/customer.types";
import type { InvoiceRow } from "@/types/invoice.types";
import type { ProductRow, ProductVariantRow } from "@/types/product.types";
import type { SaleRow } from "@/types/sale.types";

/**
 * Readers for the admin data export. Service-role client, like every other
 * query module here — the export service gates access with `requireAdmin()`.
 *
 * These deliberately do NOT reuse `getSales()`/`getCustomers()` etc. Those take
 * no arguments, apply no date bound, and — critically — issue a single
 * unbounded `select`, which PostgREST silently truncates at its `max-rows`
 * setting (1000 by default). A truncated export is the worst kind of bug: the
 * file downloads fine and quietly omits half the year. Everything below pages
 * with `.range()` until it sees a short page, so the row count is real.
 */

/** PostgREST caps a single response; stay at or under the usual `max-rows`. */
const PAGE_SIZE = 1000;

/** Hard stop, so a runaway loop can't exhaust the server's memory. */
const MAX_PAGES = 500;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Page a select to exhaustion. `build` must produce a fresh query per page — a
 * PostgREST builder is single-use once awaited.
 */
async function fetchAllPages<T>(
  label: string,
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const all: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Failed to fetch ${label} for export:`, error.message);
      throw new Error(`Could not read ${label}.`);
    }

    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }

  console.error(`Export of ${label} hit the ${MAX_PAGES}-page ceiling.`);
  throw new Error(
    `Too much ${label} data to export at once. Narrow the date range.`,
  );
}

/**
 * Upper bound for an inclusive range. DATE columns compare against the day
 * itself; timestamp columns need the end of that day, or "to 9 Aug" would drop
 * everything recorded after midnight.
 */
function endBound(end: string, isTimestamp: boolean): string {
  return isTimestamp ? `${end}T23:59:59.999` : end;
}

export async function getCustomersForExport(
  range: ExportDateRange | null,
): Promise<CustomerRow[]> {
  const supabase = createAdminClient();

  return fetchAllPages<CustomerRow>("customers", (from, to) => {
    // Ordered by created_at with an id tiebreak: without it, rows sharing a
    // timestamp can repeat or vanish across page boundaries.
    let query = supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query
        .gte("created_at", range.start)
        .lte("created_at", endBound(range.end, true));
    }
    return query.range(from, to);
  });
}

/** Every loyalty entry for the given customers, so balances can be rolled up. */
export async function getLoyaltyTransactionsForExport(
  customerIds: string[],
): Promise<LoyaltyTransactionRow[]> {
  if (customerIds.length === 0) return [];
  const supabase = createAdminClient();

  // `in()` on a huge id list blows the URL length, so chunk the lookup.
  const CHUNK = 200;
  const all: LoyaltyTransactionRow[] = [];

  for (let i = 0; i < customerIds.length; i += CHUNK) {
    const chunk = customerIds.slice(i, i + CHUNK);
    const rows = await fetchAllPages<LoyaltyTransactionRow>(
      "loyalty transactions",
      (from, to) =>
        supabase
          .from("loyalty_transactions")
          .select("*")
          .in("customer_id", chunk)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
    );
    all.push(...rows);
  }
  return all;
}

export async function getProductsForExport(
  range: ExportDateRange | null,
): Promise<{ products: ProductRow[]; variants: ProductVariantRow[] }> {
  const supabase = createAdminClient();

  const products = await fetchAllPages<ProductRow>("products", (from, to) => {
    let query = supabase
      .from("products")
      .select("*")
      // Combos are assembled from other products and carry no stock of their
      // own; the admin list hides them, so the export does too.
      .eq("is_combo", false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query
        .gte("created_at", range.start)
        .lte("created_at", endBound(range.end, true));
    }
    return query.range(from, to);
  });

  // Variants are fetched whole rather than filtered by parent id: that id list
  // would be thousands of UUIDs long, and the table is small either way.
  const variants = await fetchAllPages<ProductVariantRow>(
    "product variants",
    (from, to) =>
      supabase
        .from("product_variants")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
  );

  const productIds = new Set(products.map((p) => p.id));
  return {
    products,
    variants: variants.filter((v) => productIds.has(v.product_id)),
  };
}

export async function getSalesForExport(
  range: ExportDateRange | null,
): Promise<SaleRow[]> {
  const supabase = createAdminClient();
  // Same embeds as `SALE_SELECT` in sale.query.ts: the export needs line items
  // (catalog and extra) for the per-item file and payments to derive amount
  // paid/due.
  const select =
    "*, sale_items(*), extra_sale_items(*), sale_payments(*), order:orders(order_number)";

  return fetchAllPages<SaleRow>("sales", (from, to) => {
    let query = supabase
      .from("sales")
      .select(select)
      .order("sale_date", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query
        .gte("sale_date", range.start)
        .lte("sale_date", endBound(range.end, false));
    }
    return query.range(from, to);
  });
}

export async function getInvoicesForExport(
  range: ExportDateRange | null,
): Promise<InvoiceRow[]> {
  const supabase = createAdminClient();

  return fetchAllPages<InvoiceRow>("invoices", (from, to) => {
    let query = supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .order("issue_date", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query
        .gte("issue_date", range.start)
        .lte("issue_date", endBound(range.end, false));
    }
    return query.range(from, to);
  });
}
