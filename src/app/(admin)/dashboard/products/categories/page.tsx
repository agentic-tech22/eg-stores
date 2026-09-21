import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchCategories } from "@/services/category.service";
import { fetchProductsWithStock } from "@/services/product.service";
import type { Category } from "@/types/product.types";
import { CategoryManager } from "./CategoryManager";

export default async function CategoriesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "products.view")) redirect("/dashboard");

  let categories: Category[] = [];
  // Product titles grouped by category id, feeds the per-category product count
  // and the "these products will become uncategorized" delete warning.
  const categoryProducts: Record<string, string[]> = {};
  // On-hand units and their value at cost price, per category id.
  const categoryStock: Record<string, { units: number; costValue: number }> = {};

  try {
    categories = await fetchCategories();
    const { products, variantStock } = await fetchProductsWithStock();
    for (const p of products) {
      if (!p.categoryId) continue;
      (categoryProducts[p.categoryId] ??= []).push(p.title);

      // Variant products keep their stock on the variants, not the parent row.
      const units = p.hasVariants
        ? (variantStock[p.id]?.total ?? 0)
        : p.stockQuantity;
      const stock = (categoryStock[p.categoryId] ??= { units: 0, costValue: 0 });
      stock.units += units;
      stock.costValue += units * p.costPrice;
    }
  } catch {
    // Fallback to empty state.
  }

  const can = {
    create: ctxHasPermission(ctx, "products.create"),
    edit: ctxHasPermission(ctx, "products.edit"),
    delete: ctxHasPermission(ctx, "products.delete"),
    // Gates the Cost Value column. fetchProductsWithStock zeroes costPrice for
    // users without this grant, so the column is hidden rather than shown as a
    // misleading near-zero total.
    viewFinances: ctxHasPermission(ctx, "finances.view"),
  };

  return (
    <CategoryManager
      initialCategories={categories}
      categoryProducts={categoryProducts}
      categoryStock={categoryStock}
      currency={await getActiveCurrency()}
      can={can}
    />
  );
}
