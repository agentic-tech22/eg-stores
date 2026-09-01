/**
 * Warehouse mappers: pure helpers shared by the warehouse service and the
 * product-history service. NOT a "use server" module, so it can export plain
 * (non-async) functions.
 */

import type {
  StockMovement,
  StockMovementRow,
  Warehouse,
  WarehouseRow,
} from "@/types/warehouse.types";

export function mapWarehouseRow(row: WarehouseRow): Warehouse {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    phone: row.phone,
    isDefault: row.is_default,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map a stock_movements row to the domain type. Warehouse names are resolved
 * from the supplied id→name lookup (movements store only ids so they survive a
 * warehouse rename/deletion).
 */
export function mapStockMovementRow(
  row: StockMovementRow,
  warehouseNames: Map<string, string> = new Map(),
): StockMovement {
  const nameOf = (id: string | null) => (id ? (warehouseNames.get(id) ?? null) : null);
  return {
    id: row.id,
    type: row.type,
    productId: row.product_id,
    variantId: row.variant_id,
    productTitle: row.product_title,
    variantLabel: row.variant_label,
    warehouseId: row.warehouse_id,
    warehouseName: nameOf(row.warehouse_id),
    fromWarehouseId: row.from_warehouse_id,
    fromWarehouseName: nameOf(row.from_warehouse_id),
    toWarehouseId: row.to_warehouse_id,
    toWarehouseName: nameOf(row.to_warehouse_id),
    quantity: row.quantity,
    oldValue: row.old_value,
    newValue: row.new_value,
    note: row.note,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}
