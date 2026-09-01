import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchCombos, fetchSimpleProducts } from "@/services/combo.service";
import type { ComboWithItems, Product } from "@/types/product.types";
import { ComboManager } from "./ComboManager";

export default async function CombosPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "products.view")) redirect("/dashboard");

  let combos: ComboWithItems[] = [];
  let products: Product[] = [];

  try {
    [combos, products] = await Promise.all([
      fetchCombos(),
      fetchSimpleProducts(),
    ]);
  } catch {
    // Fallback to empty lists on read failure.
  }

  const can = {
    create: ctxHasPermission(ctx, "products.create"),
    edit: ctxHasPermission(ctx, "products.edit"),
    delete: ctxHasPermission(ctx, "products.delete"),
  };

  return (
    <div>
      <ComboManager
        initialCombos={combos}
        products={products}
        currency={await getActiveCurrency()}
        can={can}
      />
    </div>
  );
}
