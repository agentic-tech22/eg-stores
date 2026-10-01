import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProductRow, ProductVariantRow } from "@/types/product.types";

/** All products (any visibility, incl. combos). Admin-side reads only. */
export async function getProducts(): Promise<ProductRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch products:", error.message);
    return [];
  }

  return (data ?? []) as ProductRow[];
}

/**
 * Publicly listed products only (is_visible = true), including combos. Feeds the
 * storefront grid/homepage so hidden products never reach shoppers.
 */
export async function getStorefrontProducts(): Promise<ProductRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch storefront products:", error.message);
    return [];
  }

  return (data ?? []) as ProductRow[];
}

export async function getFeaturedProducts(
  limit: number = 8,
): Promise<ProductRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_featured", true)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch featured products:", error.message);
    return [];
  }

  return (data ?? []) as ProductRow[];
}

/**
 * Visible storefront products for a set of ids, in whatever order Postgres
 * returns them — callers that care about order (best sellers, say) re-sort by
 * their own ranking. Returns [] for an empty id list rather than issuing a
 * query that would match nothing.
 */
export async function getStorefrontProductsByIds(
  ids: string[],
): Promise<ProductRow[]> {
  if (ids.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("id", ids)
    .eq("is_visible", true);

  if (error) {
    console.error("Failed to fetch products by id:", error.message);
    return [];
  }

  return (data ?? []) as ProductRow[];
}

/** All non-archived variants for a product, ordered for stable display. */
export async function getVariantsByProduct(
  productId: string,
): Promise<ProductVariantRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch variants:", error.message);
    return [];
  }

  return (data ?? []) as ProductVariantRow[];
}

/** Variants for many products at once (used to compute list-view stock sums). */
export async function getVariantsForProducts(
  productIds: string[],
): Promise<ProductVariantRow[]> {
  if (productIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .in("product_id", productIds)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch variants for products:", error.message);
    return [];
  }

  return (data ?? []) as ProductVariantRow[];
}
