"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import {
  fetchProducts,
  fetchProductsWithStock,
} from "@/services/product.service";
import type { Product } from "@/types/product.types";

/**
 * Storefront-shaped product list: visible products only, combos included, no
 * cost redaction and no variant stock. Do NOT use this to refetch an admin
 * table seeded from `fetchProductsWithStock`: the two return different rows, so
 * the page would silently swap datasets on the first invalidation.
 */
export function useProducts(initialData: Product[]) {
  return useQuery({
    queryKey: queryKeys.products.list(),
    queryFn: fetchProducts,
    initialData,
  });
}

/** What the admin products page renders: the list plus per-product variant stock. */
export interface AdminProducts {
  products: Product[];
  variantStock: Record<string, { total: number; available: number }>;
}

/**
 * The admin product list, refetched through the same reader the server used to
 * render it (`fetchProductsWithStock`). That matters twice over: it applies the
 * `finances.view` cost redaction the storefront reader skips, and it carries
 * variant stock through the cache, so a sale that deducts from a variant shows
 * up without a reload instead of staying frozen at the server-rendered count.
 */
export function useAdminProducts(initialData: AdminProducts) {
  return useQuery({
    queryKey: queryKeys.products.list(),
    queryFn: fetchProductsWithStock,
    initialData,
  });
}
