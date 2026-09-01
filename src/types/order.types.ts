export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderSource = "admin" | "storefront";

/** How an order is paid. `cod` = pay on delivery, `esewa` = prepaid online. */
export type OrderPaymentMethod = "cod" | "esewa";

export type OrderPaymentStatus = "unpaid" | "paid" | "refunded";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productVariantId: string | null;
  /** Set when this line is part of a combo (header line or one of its components). */
  comboId: string | null;
  productTitle: string;
  variantLabel: string | null;
  /** Snapshot of the effective (variant ?? product) SKU at order time. */
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  combo_id: string | null;
  product_title: string;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerPhone2: string | null;
  customerAddress: string;
  status: OrderStatus;
  source: OrderSource;
  /** Warehouse this order reserves/commits/releases stock against. */
  warehouseId: string;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  esewaTransactionCode: string | null;
  esewaTransactionUuid: string | null;
  subtotal: number;
  codCharge: number;
  total: number;
  notes: string | null;
  // NCM courier
  ncmOrderId: number | null;
  ncmStatus: string | null;
  ncmFromBranch: string | null;
  ncmToBranch: string | null;
  ncmDeliveryType: string | null;
  ncmSyncedAt: string | null;
  ncmShippedAt: string | null;
  ncmDeliveredAt: string | null;
  // Inventory guards
  stockCommitted: boolean;
  stockReleased: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on detail fetches. */
  items?: OrderItem[];
  /** The sale this order was converted into, if any (null otherwise). */
  convertedSale: { id: string; saleNumber: number } | null;
}

export interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_phone2: string | null;
  customer_address: string;
  status: OrderStatus;
  source: OrderSource;
  warehouse_id: string;
  payment_method: OrderPaymentMethod;
  payment_status: OrderPaymentStatus;
  esewa_transaction_code: string | null;
  esewa_transaction_uuid: string | null;
  subtotal: number;
  cod_charge: number;
  total: number;
  notes: string | null;
  ncm_order_id: number | null;
  ncm_status: string | null;
  ncm_from_branch: string | null;
  ncm_to_branch: string | null;
  ncm_delivery_type: string | null;
  ncm_synced_at: string | null;
  ncm_shipped_at: string | null;
  ncm_delivered_at: string | null;
  stock_committed: boolean;
  stock_released: boolean;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[];
  /**
   * Embed of the converted sale. Because sales.order_id is UNIQUE, PostgREST
   * treats this as to-one and returns a single object (or null), but we accept
   * an array too in case the relationship is ever inferred as to-many.
   */
  converted_sale?:
    | { id: string; sale_number: number }
    | { id: string; sale_number: number }[]
    | null;
}

/** One line of a new order, as submitted from the admin form or storefront cart. */
export interface OrderLineInput {
  productId: string;
  productVariantId?: string | null;
  quantity: number;
}

/** Customer + line items for creating an order. */
export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string | null;
  customerAddress: string;
  notes?: string | null;
  codCharge?: number;
  /** Warehouse to reserve stock from. Storefront orders use the default warehouse. */
  warehouseId?: string;
  items: OrderLineInput[];
}
