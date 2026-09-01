import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import {
  fetchWarehouses,
  fetchWarehouseStockValue,
} from "@/services/warehouse.service";
import { fetchBusinessProfile } from "@/services/invoice.service";
import type { Warehouse, WarehouseStockValue } from "@/types/warehouse.types";
import { WarehouseManager } from "./WarehouseManager";

export default async function WarehousesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "warehouses.view")) redirect("/dashboard");

  let warehouses: Warehouse[] = [];
  let stockValue: WarehouseStockValue[] = [];
  let currency = "NPR";

  try {
    [warehouses, stockValue] = await Promise.all([
      fetchWarehouses(),
      fetchWarehouseStockValue(),
    ]);
    const profile = await fetchBusinessProfile();
    if (profile?.currency) currency = profile.currency;
  } catch {
    // Fallback to empty state.
  }

  const can = {
    create: ctxHasPermission(ctx, "warehouses.create"),
    edit: ctxHasPermission(ctx, "warehouses.edit"),
    delete: ctxHasPermission(ctx, "warehouses.delete"),
  };

  return (
    <WarehouseManager
      initialWarehouses={warehouses}
      stockValue={stockValue}
      currency={currency}
      can={can}
    />
  );
}
