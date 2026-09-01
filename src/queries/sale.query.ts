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
