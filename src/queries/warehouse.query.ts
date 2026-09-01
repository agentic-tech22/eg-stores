import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { WarehouseRow, WarehouseStockRow } from "@/types/warehouse.types";

/** All warehouses, default first then by sort order/name. Publicly readable. */
export async function getWarehouses(): Promise<WarehouseRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch warehouses:", error.message);
    return [];
  }

  return (data ?? []) as WarehouseRow[];
}

/** The id of the default (active) warehouse, or null when none is configured. */
export async function getDefaultWarehouseId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("warehouses")
    .select("id")
    .eq("is_default", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch default warehouse:", error.message);
    return null;
  }

  return data?.id ?? null;
}

/** Per-warehouse stock rows for a set of products (picker availability, etc.). */
export async function getWarehouseStockForProducts(
  productIds: string[],
): Promise<WarehouseStockRow[]> {
  if (productIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("warehouse_stock")
    .select("*")
    .in("product_id", productIds);

  if (error) {
    console.error("Failed to fetch warehouse stock:", error.message);
    return [];
  }

  return (data ?? []) as WarehouseStockRow[];
}

/** Per-warehouse stock rows for a single product (details page breakdown). */
export async function getWarehouseStockForProduct(
  productId: string,
): Promise<WarehouseStockRow[]> {
  return getWarehouseStockForProducts([productId]);
}
