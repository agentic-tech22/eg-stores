import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
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

  try {
    categories = await fetchCategories();
    const { products } = await fetchProductsWithStock();
    for (const p of products) {
      if (p.categoryId) (categoryProducts[p.categoryId] ??= []).push(p.title);
    }
  } catch {
    // Fallback to empty state.
  }

  const can = {
    create: ctxHasPermission(ctx, "products.create"),
    edit: ctxHasPermission(ctx, "products.edit"),
    delete: ctxHasPermission(ctx, "products.delete"),
  };

  return (
    <CategoryManager
      initialCategories={categories}
      categoryProducts={categoryProducts}
      can={can}
    />
  );
}
