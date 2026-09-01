import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { POS_WAREHOUSE_COOKIE } from "@/lib/pos/device-warehouse";
import { fetchProductsForPicker } from "@/services/product.service";
import { fetchWarehouses } from "@/services/warehouse.service";
import type { Product, ProductVariant } from "@/types/product.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { CreateSaleClient } from "./CreateSaleClient";

export default async function NewSalePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "sales.view")) redirect("/dashboard");
  // This page exists solely to record a sale; send users who can only view to
  // the sales list instead.
  if (!ctxHasPermission(ctx, "sales.create")) redirect("/dashboard/sales");

  let products: Product[] = [];
  let variantsByProduct: Record<string, ProductVariant[]> = {};
  let availabilityByWarehouse: WarehouseAvailability = {};
  let warehouses: Warehouse[] = [];

  try {
    const [picker, warehouseList] = await Promise.all([
      fetchProductsForPicker(),
      fetchWarehouses(),
    ]);
    products = picker.products;
    variantsByProduct = picker.variantsByProduct;
    availabilityByWarehouse = picker.availabilityByWarehouse;
    warehouses = warehouseList;
  } catch {
    // Fall back to empty data on read failure.
  }

  // This terminal's saved warehouse (a device preference; validated client-side
  // against the active list). When unset, the client prompts the cashier to pick.
  const deviceWarehouseId =
    (await cookies()).get(POS_WAREHOUSE_COOKIE)?.value ?? null;

  return (
    <CreateSaleClient
      products={products}
      variantsByProduct={variantsByProduct}
      warehouses={warehouses}
      userDefaultWarehouseId={ctx.defaultWarehouseId}
      initialDeviceWarehouseId={deviceWarehouseId}
      availabilityByWarehouse={availabilityByWarehouse}
      currency={await getActiveCurrency()}
    />
  );
}
