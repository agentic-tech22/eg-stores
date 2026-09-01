import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/types/product.types";

/** All categories, ordered for stable display. Publicly readable. */
export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch categories:", error.message);
    return [];
  }

  return (data ?? []) as CategoryRow[];
}
