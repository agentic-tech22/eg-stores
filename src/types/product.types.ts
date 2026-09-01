import type { StockMovement } from "@/types/warehouse.types";

/** A single printable barcode label: one per simple product or per variant. */
export interface BarcodeLabel {
  code: string;
  title: string;
  /** Variant display name when this label is for a variant; null otherwise. */
  variantLabel: string | null;
  sku: string | null;
  price: number;
  /** On-hand pieces for this item; the default number of copies to print. */
  stock: number;
  /** When this label was last printed (ISO), or null if never printed. */
  printedAt: string | null;
}

/** A parent category products can be grouped under (e.g. Pants, Shirts, Shoes). */
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  title: string;
  description: string | null;
  /** Auto-generated, locked, unique base SKU (assigned DB-side, never edited). */
  sku: string;
  price: number;
  /** Purchase/cost price, used to compute profit on sales. */
  costPrice: number;
  imageUrl: string | null;
  images: string[];
  isFeatured: boolean;
  /** When false, the product is hidden from the public storefront. */
  isVisible: boolean;
  /** When true, this product is a combo bundling other products (see ComboItem). */
  isCombo: boolean;
  sortOrder: number;
  /** Parent category id, or null when uncategorized. */
  categoryId: string | null;
  /** Optional scannable barcode (UPC/EAN or custom); null when unset. */
  barcode: string | null;
  hasVariants: boolean;
  /** Product-level stock. Ignored when `hasVariants` is true (use variants). */
  stockQuantity: number;
  reservedQuantity: number;
  /** stockQuantity - reservedQuantity (product-level; for variant products see ProductVariant.available). */
  available: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  sku: string;
  price: number;
  cost_price: number;
  image_url: string | null;
  images: string[] | null;
  is_featured: boolean;
  is_visible: boolean;
  is_combo: boolean;
  sort_order: number;
  category_id: string | null;
  barcode: string | null;
  has_variants: boolean;
  stock_quantity: number;
  reserved_quantity: number;
  barcode_printed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  /** Flexible attribute map, e.g. { Color: "Red", Size: "M" }. */
  attributes: Record<string, string>;
  displayName: string;
  sku: string | null;
  /** Optional scannable barcode for this variant; null when unset. */
  barcode: string | null;
  /** When null, the parent product's price applies. */
  priceOverride: number | null;
  imageUrl: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  available: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  attributes: Record<string, string> | null;
  display_name: string;
  sku: string | null;
  barcode: string | null;
  price_override: number | null;
  image_url: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  barcode_printed_at: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** A product together with its (non-archived) variants, for detail/form views. */
export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

/** A single restock event: a batch of units imported, with the cost paid. */
export interface StockEntry {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  /** Per-unit cost paid this restock. Null when unknown or redacted (no finance grant). */
  unitCost: number | null;
  note: string | null;
  /** Warehouse this batch was restocked into; null for pre-warehouse entries. */
  warehouseId: string | null;
  warehouseName: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface StockEntryRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  warehouse_id: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

/** Which money field a price change applies to. */
export type PriceField = "price" | "cost_price";

/** A logged change to a product's selling price or cost price. */
export interface PriceChange {
  id: string;
  productId: string;
  field: PriceField;
  oldValue: number | null;
  newValue: number;
  createdByEmail: string | null;
  createdAt: string;
}

export interface PriceChangeRow {
  id: string;
  product_id: string;
  field: PriceField;
  old_value: number | null;
  new_value: number;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

/** Combined restock + price + movement history for a product's history view. */
export interface ProductHistory {
  restocks: StockEntry[];
  priceChanges: PriceChange[];
  /** Manual stock edits, transfers, and deletions (from stock_movements). */
  movements: StockMovement[];
}

/** One component of a combo: a simple product included `quantity` times. */
export interface ComboItem {
  id: string;
  comboId: string;
  componentId: string;
  quantity: number;
  /** The component product, populated on detail/list reads. */
  component?: Product;
}

export interface ComboItemRow {
  id: string;
  combo_id: string;
  component_id: string;
  quantity: number;
  created_at: string;
}

/** A combo product together with its component items, for detail/form views. */
export interface ComboWithItems extends Product {
  items: ComboItem[];
  /**
   * Units buyable now, derived from the scarcest component (combos hold no stock
   * of their own). Also mirrored onto the inherited `available` field.
   */
  comboAvailable: number;
  /** Sum of each component's (price × quantity), the pre-discount total. */
  originalPrice: number;
}
