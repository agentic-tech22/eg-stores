import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchOrders } from "@/services/order.service";
import { fetchProductsForPicker } from "@/services/product.service";
import { fetchWarehouses } from "@/services/warehouse.service";
import { getNcmSettings } from "@/queries/ncm.query";
import type { NcmDeliveryType } from "@/types/ncm.types";
import type { Product, ProductVariant } from "@/types/product.types";
import type { Order } from "@/types/order.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { OrderManager } from "./OrderManager";

export default async function OrdersPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "orders.view")) redirect("/dashboard");

  let orders: Order[] = [];
  let products: Product[] = [];
  let variantsByProduct: Record<string, ProductVariant[]> = {};
  let availabilityByWarehouse: WarehouseAvailability = {};
  let warehouses: Warehouse[] = [];

  try {
    const [orderRows, picker, warehouseList] = await Promise.all([
      fetchOrders(),
      fetchProductsForPicker(),
      fetchWarehouses(),
    ]);
    orders = orderRows;
    products = picker.products;
    variantsByProduct = picker.variantsByProduct;
    availabilityByWarehouse = picker.availabilityByWarehouse;
    warehouses = warehouseList;
  } catch {
    // Fall back to empty data on read failure.
  }

  const ncmSettings = await getNcmSettings();
  const ncmDefaults = {
    fromBranch: ncmSettings?.default_from_branch ?? null,
    deliveryType:
      (ncmSettings?.default_delivery_type as NcmDeliveryType) ?? "Door2Door",
    codCharge: ncmSettings?.default_cod_charge ?? 0,
  };

  return (
    <OrderManager
      initialOrders={orders}
      products={products}
      variantsByProduct={variantsByProduct}
      warehouses={warehouses}
      availabilityByWarehouse={availabilityByWarehouse}
      currency={await getActiveCurrency()}
      can={{
        create: ctxHasPermission(ctx, "orders.create"),
        ship: ctxHasPermission(ctx, "shipments.ship"),
      }}
      ncmDefaults={ncmDefaults}
    />
  );
}
