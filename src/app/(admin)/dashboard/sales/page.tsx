import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchSales } from "@/services/sale.service";
import { fetchProductsForPicker } from "@/services/product.service";
import { fetchWarehouses } from "@/services/warehouse.service";
import type { Product, ProductVariant } from "@/types/product.types";
import type { Sale } from "@/types/sale.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { SalesManager } from "./SalesManager";

export default async function SalesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "sales.view")) redirect("/dashboard");

  let sales: Sale[] = [];
  let products: Product[] = [];
  let variantsByProduct: Record<string, ProductVariant[]> = {};
  let availabilityByWarehouse: WarehouseAvailability = {};
  let warehouses: Warehouse[] = [];

  try {
    const [saleRows, picker, warehouseList] = await Promise.all([
      fetchSales(),
      fetchProductsForPicker(),
      fetchWarehouses(),
    ]);
    sales = saleRows;
    products = picker.products;
    variantsByProduct = picker.variantsByProduct;
    availabilityByWarehouse = picker.availabilityByWarehouse;
    warehouses = warehouseList;
  } catch {
    // Fall back to empty data on read failure.
  }

  return (
    <SalesManager
      initialSales={sales}
      products={products}
      variantsByProduct={variantsByProduct}
      warehouses={warehouses}
      userDefaultWarehouseId={ctx.defaultWarehouseId}
      availabilityByWarehouse={availabilityByWarehouse}
      currency={await getActiveCurrency()}
      can={{
        create: ctxHasPermission(ctx, "sales.create"),
      }}
    />
  );
}
