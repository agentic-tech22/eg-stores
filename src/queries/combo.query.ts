import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ComboItemRow, ProductRow } from "@/types/product.types";

/** All combo products (products.is_combo = true), ordered for stable display. */
export async function getCombos(): Promise<ProductRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_combo", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch combos:", error.message);
    return [];
  }

  return (data ?? []) as ProductRow[];
}

/** The component rows for a single combo. */
export async function getComboItems(comboId: string): Promise<ComboItemRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("combo_items")
    .select("*")
    .eq("combo_id", comboId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch combo items:", error.message);
    return [];
  }

  return (data ?? []) as ComboItemRow[];
}

/** Component rows for many combos at once (for list-view availability sums). */
export async function getComboItemsForCombos(
  comboIds: string[],
): Promise<ComboItemRow[]> {
  if (comboIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("combo_items")
    .select("*")
    .in("combo_id", comboIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch combo items for combos:", error.message);
    return [];
  }

  return (data ?? []) as ComboItemRow[];
}
