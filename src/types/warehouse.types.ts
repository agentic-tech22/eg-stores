/** A physical stock location. The same product/variant can be stocked in many. */
export interface Warehouse {
  id: string;
  name: string;
  /** Short human code (e.g. "MAIN", "KTM"); null when unset. */
  code: string | null;
  address: string | null;
  phone: string | null;
  /** Exactly one warehouse is the default (prefills forms, storefront fulfillment). */
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseRow {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Per-location on-hand + reserved count for a product or variant. */
export interface WarehouseStockRow {
  id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = "edit" | "transfer" | "deletion";

/** One audit-log entry: a manual stock edit, a transfer, or a deletion. */
export interface StockMovement {
  id: string;
  type: StockMovementType;
  productId: string | null;
  variantId: string | null;
  productTitle: string | null;
  variantLabel: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  fromWarehouseId: string | null;
  fromWarehouseName: string | null;
  toWarehouseId: string | null;
  toWarehouseName: string | null;
  quantity: number | null;
  oldValue: number | null;
  newValue: number | null;
  note: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface StockMovementRow {
  id: string;
  type: StockMovementType;
  product_id: string | null;
  variant_id: string | null;
  product_title: string | null;
  variant_label: string | null;
  warehouse_id: string | null;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  quantity: number | null;
  old_value: number | null;
  new_value: number | null;
  note: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

/** A product/variant's on-hand + reserved count in a single warehouse, for the
 * per-warehouse breakdown on the product details page. */
export interface WarehouseStockLevel {
  warehouseId: string;
  warehouseName: string;
  variantId: string | null;
  variantLabel: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  available: number;
}

/** Aggregate on-hand units (+ optional cost value) for one warehouse. */
export interface WarehouseStockValue {
  warehouseId: string;
  warehouseName: string;
  units: number;
  /** Σ stock × cost_price; null for callers without finances.view. */
  costValue: number | null;
}

/** Per-warehouse available (stock − reserved) for products and variants, keyed
 * by warehouse id then product/variant id. Feeds the sale/order line pickers. */
export type WarehouseAvailability = Record<
  string,
  { products: Record<string, number>; variants: Record<string, number> }
>;

/** Input for moving a chosen quantity between warehouses. */
export interface TransferStockInput {
  productId: string;
  productVariantId?: string | null;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  note?: string | null;
}
