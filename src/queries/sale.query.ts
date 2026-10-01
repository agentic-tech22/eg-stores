import { createAdminClient } from "@/lib/supabase/server";
import type { SaleRow } from "@/types/sale.types";

/**
 * Sale reads use the service-role client because `sales`/`sale_items` have no
 * public RLS read policy (they are business-wide, not row-scoped). Callers in
 * the service layer gate access with `requirePermission("sales.view")`.
 */

// `order` is a to-one embed of the source order (null for direct sales).
// `sale_payments` is the collection ledger, from which amount-paid and the due
// are derived, and always joined so any sale read can show what is still owed.
// `extra_sale_items` holds the non-catalog counter lines: part of the same bill,
// but kept out of `sale_items` so product reporting never sees them.
const SALE_SELECT =
  "*, sale_items(*), extra_sale_items(*), sale_payments(*), order:orders(order_number)";

export async function getSales(): Promise<SaleRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch sales:", error.message);
    return [];
  }
  return (data ?? []) as SaleRow[];
}

export async function getSaleById(id: string): Promise<SaleRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as SaleRow;
}

/**
 * How many rows to pull per page, and how many pages to allow.
 *
 * PostgREST caps a single `select` at 1000 rows, so the only way to sum every
 * line item without a database-side aggregate is to page through them. The page
 * cap bounds that walk: 50 pages is 50k line items, far beyond this shop, and
 * stops an ever-growing table from turning the home page into an unbounded read.
 */
const SALE_ITEM_PAGE_SIZE = 1000;
const SALE_ITEM_MAX_PAGES = 50;

/**
 * Product ids ranked by units sold, best first.
 *
 * Deliberately returns ids and nothing else. The ranking itself is fine to show
 * a shopper ("best sellers"), but the unit counts behind it are the shop's
 * trading volume, so they never leave this module.
 *
 * Aggregates in TypeScript rather than in a Postgres function on purpose: this
 * project does not run schema migrations, so the feature has to work against the
 * tables exactly as they already exist. The cost is this paged walk, which is
 * why only `product_id` and `quantity` are selected — two columns per line item
 * keeps the transfer small even over several pages.
 *
 * Newest rows are walked first, so in the unlikely event the page cap is hit the
 * ranking degrades to "best sellers over recent history" rather than over an
 * arbitrary slice.
 *
 * Caps the result at `max` ids. The caller still has to drop the ones that are
 * no longer visible in the storefront, so this returns a candidate list rather
 * than exactly the number of tiles a rail wants to show. The default leaves
 * plenty of headroom over a ten-tile rail while keeping the follow-up
 * `in(...)` lookup short enough to stay well inside PostgREST's URL limit.
 */
export async function getBestSellingProductIds(max: number = 50): Promise<string[]> {
  const supabase = createAdminClient();
  const units = new Map<string, number>();

  for (let page = 0; page < SALE_ITEM_MAX_PAGES; page++) {
    const from = page * SALE_ITEM_PAGE_SIZE;
    const { data, error } = await supabase
      .from("sale_items")
      .select("product_id, quantity")
      .not("product_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + SALE_ITEM_PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch sale items:", error.message);
      return [];
    }

    const rows = (data ?? []) as { product_id: string; quantity: number }[];
    for (const row of rows) {
      units.set(row.product_id, (units.get(row.product_id) ?? 0) + row.quantity);
    }

    // A short page is the last page.
    if (rows.length < SALE_ITEM_PAGE_SIZE) break;
  }

  return [...units.entries()]
    // Ties break on id so the rail does not reshuffle between renders.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([productId]) => productId);
}
