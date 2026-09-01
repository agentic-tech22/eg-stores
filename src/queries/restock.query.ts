import { createAdminClient } from "@/lib/supabase/server";
import type { PriceChangeRow, StockEntryRow } from "@/types/product.types";

// These tables have RLS enabled with no policies (service-role only), so reads
// go through the admin client, gated by permissions in the service layer.

/** Restock ledger entries for a product, newest first. Admin-side reads only. */
export async function getStockEntries(
  productId: string,
): Promise<StockEntryRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("product_stock_entries")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch stock entries:", error.message);
    return [];
  }

  return (data ?? []) as StockEntryRow[];
}

/** Price-change history for a product, newest first. Admin-side reads only. */
export async function getPriceChanges(
  productId: string,
): Promise<PriceChangeRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("product_price_changes")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch price changes:", error.message);
    return [];
  }

  return (data ?? []) as PriceChangeRow[];
}
