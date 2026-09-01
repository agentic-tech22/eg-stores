import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import {
  fetchStockMovements,
  fetchWarehouses,
} from "@/services/warehouse.service";
import { fetchProductsForPicker } from "@/services/product.service";
import { TransferManager } from "./TransferManager";

export default async function TransfersPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "warehouses.view")) redirect("/dashboard");

  const [warehouses, picker, movements] = await Promise.all([
    fetchWarehouses(),
    fetchProductsForPicker(),
    fetchStockMovements(),
  ]);

  return (
    <TransferManager
      warehouses={warehouses}
      products={picker.products}
      variantsByProduct={picker.variantsByProduct}
      availabilityByWarehouse={picker.availabilityByWarehouse}
      movements={movements}
      canTransfer={ctxHasPermission(ctx, "warehouses.edit")}
    />
  );
}
