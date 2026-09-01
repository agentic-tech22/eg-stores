import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchProductsWithStock } from "@/services/product.service";
import type { Product } from "@/types/product.types";
import { ProductManager } from "./ProductManager";

export default async function ProductsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "products.view")) redirect("/dashboard");

  let products: Product[] = [];
  let variantStock: Record<string, { total: number; available: number }> = {};

  try {
    const result = await fetchProductsWithStock();
    products = result.products;
    variantStock = result.variantStock;
  } catch {
    // Fallback
  }

  const can = {
    create: ctxHasPermission(ctx, "products.create"),
    edit: ctxHasPermission(ctx, "products.edit"),
    delete: ctxHasPermission(ctx, "products.delete"),
    // Gates the cost-derived Inventory Value card; cost itself is redacted
    // server-side by fetchProductsWithStock for the same grant.
    viewFinances: ctxHasPermission(ctx, "finances.view"),
  };

  return (
    <div>
      <ProductManager
        initialProducts={products}
        variantStock={variantStock}
        currency={await getActiveCurrency()}
        can={can}
      />
    </div>
  );
}
