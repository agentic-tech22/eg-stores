"use server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  ctxHasPermission,
  getAuthContext,
  requireAuth,
  requirePermission,
} from "@/lib/auth/session";
import {
  getFeaturedProducts,
  getProducts,
  getStorefrontProducts,
  getStorefrontProductsByIds,
  getVariantsByProduct,
  getVariantsForProducts,
} from "@/queries/product.query";
import { getBestSellingProductIds } from "@/queries/sale.query";
import {
  getDefaultWarehouseId,
  getWarehouseStockForProducts,
} from "@/queries/warehouse.query";
import { recordPriceChanges } from "@/lib/products/price-history";
import type { AuthContext } from "@/types/user.types";
import {
  planShapeChange,
  retireStock,
  setWarehouseStockAndLog,
} from "@/services/product-stock-engine";
import type {
  BarcodeLabel,
  Product,
  ProductRow,
  ProductVariant,
  ProductVariantRow,
  ProductWithVariants,
} from "@/types/product.types";
import type {
  WarehouseAvailability,
  WarehouseStockLevel,
} from "@/types/warehouse.types";

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sku: row.sku,
    price: row.price,
    costPrice: row.cost_price,
    imageUrl: row.image_url,
    images: row.images ?? [],
    isFeatured: row.is_featured,
    isVisible: row.is_visible,
    isCombo: row.is_combo,
    sortOrder: row.sort_order,
    categoryId: row.category_id,
    barcode: row.barcode,
    hasVariants: row.has_variants,
    stockQuantity: row.stock_quantity,
    reservedQuantity: row.reserved_quantity,
    available: row.stock_quantity - row.reserved_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Whether the current caller may see cost/profit. Used to strip cost data from
 * read payloads so it never reaches users (incl. the anon storefront) without
 * the `finances.view` grant: UI hiding alone would still ship cost over the wire.
 */
async function canViewFinance(): Promise<boolean> {
  return ctxHasPermission(await getAuthContext(), "finances.view");
}

/** Zero out costPrice unless the caller may see it. */
function redactCost(product: Product, canView: boolean): Product {
  return canView ? product : { ...product, costPrice: 0 };
}

/** Turn known DB constraint violations into friendly, user-facing messages. */
function friendlyWriteError(message: string): string {
  if (/barcode/i.test(message) && /(unique|duplicate)/i.test(message)) {
    return "That barcode is already used by another product or variant.";
  }
  return message;
}

function mapVariantRow(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    attributes: row.attributes ?? {},
    displayName: row.display_name,
    sku: row.sku,
    barcode: row.barcode,
    priceOverride: row.price_override,
    imageUrl: row.image_url,
    stockQuantity: row.stock_quantity,
    reservedQuantity: row.reserved_quantity,
    available: row.stock_quantity - row.reserved_quantity,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// NOTE: fetchProducts / fetchProductById / fetchFeaturedProducts are shared with
// the public storefront, so they deliberately DON'T call canViewFinance():
// reading cookies there would force those pages into dynamic rendering. Cost is
// redacted only in the admin-only reads below. (None of the storefront or admin
// list views render cost; the admin product form is gated in the UI and omits
// cost from its save payload.)
// Storefront-facing list: only publicly visible products (incl. combos).
export async function fetchProducts(): Promise<Product[]> {
  const rows = await getStorefrontProducts();
  return rows.map(mapProductRow);
}

/**
 * Products plus a map of summed available/total stock for variant products,
 * so the admin list can show effective stock without N+1 fetches.
 */
export async function fetchProductsWithStock(): Promise<{
  products: Product[];
  variantStock: Record<string, { total: number; available: number }>;
}> {
  // Combos are managed on their own page; keep them out of the product list.
  const rows = (await getProducts()).filter((r) => !r.is_combo);
  const canView = await canViewFinance();
  const products = rows.map((r) => redactCost(mapProductRow(r), canView));
  const variantProductIds = products
    .filter((p) => p.hasVariants)
    .map((p) => p.id);

  const variantRows = await getVariantsForProducts(variantProductIds);
  const variantStock: Record<string, { total: number; available: number }> = {};
  for (const v of variantRows) {
    const entry = (variantStock[v.product_id] ??= { total: 0, available: 0 });
    entry.total += v.stock_quantity;
    entry.available += v.stock_quantity - v.reserved_quantity;
  }

  return { products, variantStock };
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapProductRow(data as ProductRow);
}

export async function fetchProductWithVariants(
  id: string,
): Promise<ProductWithVariants | null> {
  const product = await fetchProductById(id);
  if (!product) return null;
  const variantRows = product.hasVariants ? await getVariantsByProduct(id) : [];
  return { ...product, variants: variantRows.map(mapVariantRow) };
}

/**
 * Products plus their variants, keyed by product id, feeding the admin order
 * line-item picker so it can offer variant selection and show availability.
 */
export async function fetchProductsForPicker(): Promise<{
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  availabilityByWarehouse: WarehouseAvailability;
}> {
  // Shared by the order, sale, and transfer line-item pickers, so accept any of
  // those viewers.
  const ctx = await requireAuth();
  if (
    !ctxHasPermission(ctx, "orders.view") &&
    !ctxHasPermission(ctx, "sales.view") &&
    !ctxHasPermission(ctx, "warehouses.view")
  ) {
    throw new AuthorizationError();
  }
  // Combos aren't directly orderable from the picker (their components are);
  // exclude them so the line-item picker lists only standalone products.
  const rows = (await getProducts()).filter((r) => !r.is_combo);
  const canView = await canViewFinance();
  const products = rows.map((r) => redactCost(mapProductRow(r), canView));
  const variantIds = products.filter((p) => p.hasVariants).map((p) => p.id);
  const variantRows = await getVariantsForProducts(variantIds);

  const variantsByProduct: Record<string, ProductVariant[]> = {};
  for (const vr of variantRows) {
    (variantsByProduct[vr.product_id] ??= []).push(mapVariantRow(vr));
  }

  // Per-warehouse available (stock − reserved), from a single warehouse_stock
  // read for all picker products (grouped in JS; no N+1).
  const stockRows = await getWarehouseStockForProducts(
    products.map((p) => p.id),
  );
  const availabilityByWarehouse: WarehouseAvailability = {};
  for (const s of stockRows) {
    const bucket = (availabilityByWarehouse[s.warehouse_id] ??= {
      products: {},
      variants: {},
    });
    const available = s.stock_quantity - s.reserved_quantity;
    if (s.variant_id) bucket.variants[s.variant_id] = available;
    else bucket.products[s.product_id] = available;
  }

  return { products, variantsByProduct, availabilityByWarehouse };
}

/**
 * Per-warehouse stock levels for a single product (and its variants), powering
 * the product details page breakdown. Gated by `products.view`.
 */
export async function fetchProductInventory(
  productId: string,
): Promise<WarehouseStockLevel[]> {
  await requirePermission("products.view");
  const supabase = createAdminClient();

  const [{ data: stockData }, { data: whData }, { data: variantData }] =
    await Promise.all([
      supabase
        .from("warehouse_stock")
        .select("warehouse_id, variant_id, stock_quantity, reserved_quantity")
        .eq("product_id", productId),
      supabase.from("warehouses").select("id, name").order("name"),
      supabase
        .from("product_variants")
        .select("id, display_name")
        .eq("product_id", productId),
    ]);

  const warehouseNames = new Map(
    ((whData ?? []) as { id: string; name: string }[]).map((w) => [
      w.id,
      w.name,
    ]),
  );
  const variantNames = new Map(
    ((variantData ?? []) as { id: string; display_name: string }[]).map((v) => [
      v.id,
      v.display_name,
    ]),
  );

  return (
    (stockData ?? []) as {
      warehouse_id: string;
      variant_id: string | null;
      stock_quantity: number;
      reserved_quantity: number;
    }[]
  ).map((s) => ({
    warehouseId: s.warehouse_id,
    warehouseName: warehouseNames.get(s.warehouse_id) ?? "N/A",
    variantId: s.variant_id,
    variantLabel: s.variant_id
      ? (variantNames.get(s.variant_id) ?? null)
      : null,
    stockQuantity: s.stock_quantity,
    reservedQuantity: s.reserved_quantity,
    available: s.stock_quantity - s.reserved_quantity,
  }));
}

/**
 * Turn a set of raw product rows (already filtered to non-combos) into printable
 * barcode labels: one per simple product, or one per variant for variant
 * products. Pulls in the variants for any variant parents and preserves the
 * order of `prodData`. Only the public selling price is included (no cost).
 */
async function buildBarcodeLabels(
  prodData: ProductRow[],
): Promise<BarcodeLabel[]> {
  const products = prodData.map((r) => mapProductRow(r));
  const variantParentIds = products
    .filter((p) => p.hasVariants)
    .map((p) => p.id);

  // barcode_printed_at is not carried on the mapped Product/ProductVariant, so
  // capture it (keyed by the scannable code) straight from the raw rows.
  const printedByCode = new Map<string, string | null>();
  for (const r of prodData) {
    if (r.barcode) printedByCode.set(r.barcode, r.barcode_printed_at);
  }

  const variantsByProduct: Record<string, ProductVariant[]> = {};
  if (variantParentIds.length) {
    const variantRows = await getVariantsForProducts(variantParentIds);
    for (const vr of variantRows) {
      if (vr.barcode) printedByCode.set(vr.barcode, vr.barcode_printed_at);
      (variantsByProduct[vr.product_id] ??= []).push(mapVariantRow(vr));
    }
  }

  const labels: BarcodeLabel[] = [];
  for (const p of products) {
    if (p.hasVariants) {
      for (const v of variantsByProduct[p.id] ?? []) {
        if (!v.barcode) continue;
        labels.push({
          code: v.barcode,
          title: p.title,
          variantLabel: v.displayName,
          sku: v.sku,
          price: v.priceOverride ?? p.price,
          stock: v.stockQuantity,
          printedAt: printedByCode.get(v.barcode) ?? null,
        });
      }
    } else if (p.barcode) {
      labels.push({
        code: p.barcode,
        title: p.title,
        variantLabel: null,
        sku: p.sku,
        price: p.price,
        stock: p.stockQuantity,
        printedAt: printedByCode.get(p.barcode) ?? null,
      });
    }
  }
  return labels;
}

/** Filters for the Barcodes page browse/search view. All fields optional. */
export interface BarcodeFilters {
  /** Free-text match on product title / SKU / barcode. */
  search?: string;
  /** Whether the label has ever been printed. Defaults to "all". */
  printed?: "all" | "printed" | "unprinted";
  /** Lower bound (ISO) on the product's created_at ("date added"). */
  since?: string | null;
}

/**
 * Printable barcode labels for the Barcodes page, filtered by `filters`. Returns
 * one label per simple product, or one per variant for variant products (combos
 * excluded, since they aren't scanned at the till); only the public selling price is
 * included (no cost). With no search and no filters this is just the most
 * recently added products, so the page has a useful default list.
 *
 * The `printed` filter is applied to the built labels rather than in SQL: a
 * variant product's printed state lives per-variant, so filtering the parent
 * `products.barcode_printed_at` column would be wrong.
 */
export async function fetchBarcodeItems(
  filters: BarcodeFilters = {},
): Promise<BarcodeLabel[]> {
  await requirePermission("products.view");

  // Keep the term to catalog-safe characters so it can't break the PostgREST
  // `.or` filter (which is comma/paren-delimited) or be used for injection.
  const safe = (filters.search ?? "").replace(/[^a-zA-Z0-9 .\-]/g, " ").trim();
  const printed = filters.printed ?? "all";
  const isFiltered =
    Boolean(safe) || Boolean(filters.since) || printed !== "all";

  const supabase = createAdminClient();
  let q = supabase.from("products").select("*").eq("is_combo", false);
  if (safe) {
    const pattern = `*${safe}*`; // `*` is the ilike wildcard in PostgREST `.or`.
    q = q.or(
      `title.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`,
    );
  }
  if (filters.since) q = q.gte("created_at", filters.since);
  // Text search reads best alphabetically; a plain/filtered browse reads best
  // newest-first. A bare default view stays short; any active filter widens it.
  q = safe
    ? q.order("title", { ascending: true })
    : q.order("created_at", { ascending: false });
  q = q.limit(isFiltered ? 200 : 12);

  const { data: prodData } = await q;
  let labels = await buildBarcodeLabels((prodData ?? []) as ProductRow[]);
  if (printed === "printed") labels = labels.filter((l) => l.printedAt);
  else if (printed === "unprinted") labels = labels.filter((l) => !l.printedAt);
  return labels;
}

/**
 * Stamp the given barcodes as printed (barcode_printed_at = now) so the
 * Barcodes page can show which codes have already been run off. A code may
 * belong to either a simple product or a variant, so both tables are updated;
 * unknown codes are simply no-ops. Returns the timestamp applied.
 */
export async function markBarcodesPrinted(
  codes: string[],
): Promise<{ printedAt: string }> {
  await requirePermission("products.edit");
  const printedAt = new Date().toISOString();
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return { printedAt };

  const supabase = createAdminClient();
  await Promise.all([
    supabase
      .from("products")
      .update({ barcode_printed_at: printedAt })
      .in("barcode", unique),
    supabase
      .from("product_variants")
      .update({ barcode_printed_at: printedAt })
      .in("barcode", unique),
  ]);
  return { printedAt };
}

export async function fetchFeaturedProducts(
  limit?: number,
): Promise<Product[]> {
  const rows = await getFeaturedProducts(limit);
  return rows.map(mapProductRow);
}

/**
 * The shop's best sellers, most units sold first.
 *
 * Ungated on purpose, like `fetchProducts` and `fetchMembershipShopInfo`: the
 * storefront home page is unauthenticated. The ranking is computed behind the
 * service-role client because `sale_items` is not client-readable, but only the
 * resulting products cross back out — no unit counts, no revenue, no cost.
 *
 * Ranks first and filters to visible products second, so a hidden or deleted
 * best seller gives up its slot to the next product down rather than leaving a
 * hole in the rail. Returns fewer than `limit` (or nothing at all) when the shop
 * has not sold that many distinct products yet: callers decide whether to hide
 * the section, rather than this inventing a ranking the sales data cannot back.
 */
export async function fetchBestSellingProducts(
  limit: number = 10,
): Promise<Product[]> {
  const rankedIds = await getBestSellingProductIds();
  if (rankedIds.length === 0) return [];

  const rows = await getStorefrontProductsByIds(rankedIds);
  const byId = new Map(rows.map((row) => [row.id, mapProductRow(row)]));

  // `in()` does not preserve the ranking, so rebuild it from the id order.
  return rankedIds
    .map((id) => byId.get(id))
    .filter((p): p is Product => p !== undefined)
    .slice(0, limit);
}

/** A variant as submitted from the product form. `id` set = existing row. */
export interface VariantInput {
  id?: string;
  attributes: Record<string, string>;
  displayName: string;
  sku?: string | null;
  barcode?: string | null;
  priceOverride?: number | null;
  stockQuantity: number;
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

/**
 * Reconcile the variant rows for a product against the submitted list:
 * archive variants that are no longer present, insert new ones, and update
 * the editable fields of existing ones. Stock is written per-warehouse (the
 * default) via set_warehouse_stock, never as a direct column. `reserved_quantity`
 * is never touched here: it is owned by the order engine.
 */
async function syncVariants(
  supabase: SupabaseClient,
  productId: string,
  variants: VariantInput[],
  opts: {
    warehouseId: string;
    productTitle: string | null;
    ctx: AuthContext;
    logEdits: boolean;
  },
): Promise<{ error?: string }> {
  const { data: existingData } = await supabase
    .from("product_variants")
    .select("id, display_name")
    .eq("product_id", productId)
    .eq("archived", false);

  const existingRows = (existingData ?? []) as {
    id: string;
    display_name: string | null;
  }[];
  const existingIds = new Set(existingRows.map((r) => r.id));
  const keptIds = new Set(
    variants.map((v) => v.id).filter((id): id is string => Boolean(id)),
  );

  // Archive variants the user removed. Their stock is retired first: an archived
  // variant is no longer summed into the product, so leaving the warehouse_stock
  // rows behind would strand those units.
  const toArchive = existingRows.filter((r) => !keptIds.has(r.id));
  if (toArchive.length > 0) {
    for (const row of toArchive) {
      await retireStock(supabase, {
        productId,
        variantId: row.id,
        productTitle: opts.productTitle,
        variantLabel: row.display_name,
        ctx: opts.ctx,
      });
    }
    const { error } = await supabase
      .from("product_variants")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .in(
        "id",
        toArchive.map((r) => r.id),
      );
    if (error) return { error: error.message };
  }

  for (const v of variants) {
    // Include barcode only when set: on insert an omitted barcode triggers the
    // DB DEFAULT (auto-assign); on update it leaves the existing one unchanged.
    // Stock is NOT written here: it lives per-warehouse and is set below via
    // set_warehouse_stock so the cached total never drifts.
    const barcode = v.barcode?.trim();
    const payload: Record<string, unknown> = {
      product_id: productId,
      attributes: v.attributes,
      display_name: v.displayName,
      sku: v.sku ?? null,
      price_override: v.priceOverride ?? null,
      updated_at: new Date().toISOString(),
      ...(barcode ? { barcode } : {}),
    };
    let variantId = v.id ?? null;
    if (v.id && existingIds.has(v.id)) {
      const { error } = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", v.id);
      if (error) return { error: friendlyWriteError(error.message) };
    } else {
      const { data: insertedVariant, error } = await supabase
        .from("product_variants")
        .insert(payload)
        .select("id")
        .single();
      if (error) return { error: friendlyWriteError(error.message) };
      variantId = (insertedVariant as { id: string }).id;
    }

    if (variantId) {
      await setWarehouseStockAndLog(supabase, {
        warehouseId: opts.warehouseId,
        productId,
        variantId,
        newQty: v.stockQuantity,
        productTitle: opts.productTitle,
        variantLabel: v.displayName,
        ctx: opts.ctx,
        logEdit: opts.logEdits,
      });
    }
  }

  return {};
}

export async function createProduct(data: {
  title: string;
  description?: string;
  price: number;
  /** Optional: omitted for users who can't see finances; defaults to 0. */
  costPrice?: number;
  imageUrl?: string;
  images?: string[];
  isFeatured?: boolean;
  isVisible?: boolean;
  categoryId?: string | null;
  barcode?: string | null;
  hasVariants?: boolean;
  stockQuantity?: number;
  variants?: VariantInput[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requirePermission("products.create");

    if (data.costPrice !== undefined && data.costPrice > data.price) {
      return {
        success: false,
        error: "Cost price cannot be greater than the selling price.",
      };
    }

    const warehouseId = await getDefaultWarehouseId();
    if (!warehouseId) {
      return { success: false, error: "No warehouse is configured." };
    }

    const supabase = createAdminClient();

    // Insert with 0 stock; stock is then set per-warehouse via the RPC (which
    // also bumps the cached total), so warehouse_stock stays the source of truth.
    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        title: data.title,
        description: data.description ?? null,
        price: data.price,
        cost_price: data.costPrice ?? 0,
        image_url: data.imageUrl ?? null,
        images: data.images ?? [],
        is_featured: data.isFeatured ?? false,
        is_visible: data.isVisible ?? true,
        category_id: data.categoryId ?? null,
        // Omit when blank so the DB DEFAULT auto-assigns a unique barcode;
        // `undefined` is dropped from the insert payload, `null` would not be.
        barcode: data.barcode?.trim() || undefined,
        has_variants: data.hasVariants ?? false,
        stock_quantity: 0,
      })
      .select("id, title")
      .single();

    if (error || !inserted) {
      return {
        success: false,
        error: error ? friendlyWriteError(error.message) : "Insert failed",
      };
    }

    const productId = (inserted as { id: string }).id;
    const productTitle = (inserted as { title: string }).title;

    if (data.hasVariants && data.variants?.length) {
      const result = await syncVariants(supabase, productId, data.variants, {
        warehouseId,
        productTitle,
        ctx,
        logEdits: false, // initial stock on create is not an "edit"
      });
      if (result.error) return { success: false, error: result.error };
    } else if (!data.hasVariants) {
      await setWarehouseStockAndLog(supabase, {
        warehouseId,
        productId,
        variantId: null,
        newQty: data.stockQuantity ?? 0,
        productTitle,
        variantLabel: null,
        ctx,
        logEdit: false,
      });
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updateProduct(
  productId: string,
  data: {
    title?: string;
    description?: string;
    price?: number;
    costPrice?: number;
    imageUrl?: string;
    images?: string[];
    isFeatured?: boolean;
    isVisible?: boolean;
    categoryId?: string | null;
    barcode?: string | null;
    hasVariants?: boolean;
    stockQuantity?: number;
    variants?: VariantInput[];
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requirePermission("products.edit");
    const supabase = createAdminClient();

    // Product title (snapshot for stock-edit audit rows) + default warehouse.
    const { data: titleRow } = await supabase
      .from("products")
      .select("title")
      .eq("id", productId)
      .single();
    const productTitle = (titleRow as { title: string } | null)?.title ?? null;
    const warehouseId = await getDefaultWarehouseId();

    // Whether this save flips the product between simple and variant form. Each
    // direction strands the stock held in the shape being left behind, so both
    // are retired explicitly below.
    const { data: shapeRow } = await supabase
      .from("products")
      .select("has_variants")
      .eq("id", productId)
      .single();
    const wasVariantProduct =
      (shapeRow as { has_variants: boolean } | null)?.has_variants ?? false;
    const { becomesVariantProduct, convertingToVariants, convertingToSimple } =
      planShapeChange({
        wasVariantProduct,
        nextHasVariants: data.hasVariants,
      });

    // Enforce: cost price must not exceed the selling price. Compare the
    // effective final values, falling back to the stored ones when only one
    // side is being changed. The stored values double as the "old" side of the
    // price-change audit below.
    let current: { price: number; cost_price: number } | null = null;
    if (data.price !== undefined || data.costPrice !== undefined) {
      const { data: cur } = await supabase
        .from("products")
        .select("price, cost_price")
        .eq("id", productId)
        .single();
      current = (cur as { price: number; cost_price: number } | null) ?? null;
      const effectivePrice = data.price ?? current?.price ?? 0;
      const effectiveCost = data.costPrice ?? current?.cost_price ?? 0;
      if (effectiveCost > effectivePrice) {
        return {
          success: false,
          error: "Cost price cannot be greater than the selling price.",
        };
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.costPrice !== undefined) updateData.cost_price = data.costPrice;
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
    if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured;
    if (data.isVisible !== undefined) updateData.is_visible = data.isVisible;
    if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
    // Only overwrite the barcode when a non-empty value is supplied; a blank
    // leaves the existing (possibly auto-assigned) barcode in place.
    if (data.barcode != null && data.barcode.trim())
      updateData.barcode = data.barcode.trim();
    if (data.hasVariants !== undefined)
      updateData.has_variants = data.hasVariants;
    // Product-level stock is NOT written directly anymore: it's set per-warehouse
    // below via set_warehouse_stock so the cached total stays consistent.

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId);

    if (error) {
      return { success: false, error: friendlyWriteError(error.message) };
    }

    // Simple -> variants: the product's own stock is no longer counted (the
    // variants own it now), so retire it instead of leaving orphaned rows.
    if (convertingToVariants) {
      await retireStock(supabase, {
        productId,
        variantId: null,
        productTitle,
        variantLabel: null,
        ctx,
      });
    }

    // Variants -> simple: the variants stop being summed into the product, so
    // clear their stock and archive them before the product-level count below
    // becomes the single source of truth.
    if (convertingToSimple) {
      const { data: liveVariants } = await supabase
        .from("product_variants")
        .select("id, display_name")
        .eq("product_id", productId)
        .eq("archived", false);

      const rows = (liveVariants ?? []) as {
        id: string;
        display_name: string | null;
      }[];
      for (const row of rows) {
        await retireStock(supabase, {
          productId,
          variantId: row.id,
          productTitle,
          variantLabel: row.display_name,
          ctx,
        });
      }
      if (rows.length > 0) {
        await supabase
          .from("product_variants")
          .update({ archived: true, updated_at: new Date().toISOString() })
          .in(
            "id",
            rows.map((r) => r.id),
          );
      }
    }

    // Product-level stock only applies when not using variants; write it into the
    // default warehouse (logged as an edit when the count changes).
    if (
      data.stockQuantity !== undefined &&
      !becomesVariantProduct &&
      warehouseId
    ) {
      await setWarehouseStockAndLog(supabase, {
        warehouseId,
        productId,
        variantId: null,
        newQty: data.stockQuantity,
        productTitle,
        variantLabel: null,
        ctx,
        logEdit: true,
      });
    }

    // Audit any selling-price / cost-price change (no-ops are skipped inside).
    if (current) {
      const changes = [];
      if (data.price !== undefined)
        changes.push({
          field: "price" as const,
          oldValue: current.price,
          newValue: data.price,
        });
      if (data.costPrice !== undefined)
        changes.push({
          field: "cost_price" as const,
          oldValue: current.cost_price,
          newValue: data.costPrice,
        });
      await recordPriceChanges(supabase, productId, changes, {
        userId: ctx.userId,
        email: ctx.email,
      });
    }

    if (data.hasVariants && data.variants) {
      if (!warehouseId) {
        return { success: false, error: "No warehouse is configured." };
      }
      const result = await syncVariants(supabase, productId, data.variants, {
        warehouseId,
        productTitle,
        ctx,
        logEdits: true,
      });
      if (result.error) return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Titles of the combos that include `productId` as a component.
 *
 * Two queries rather than one embedded select: combo_items has *two* FKs to
 * products (combo_id and component_id), so a nested `products(title)` is
 * ambiguous to PostgREST and has to be disambiguated by generated constraint
 * name. Fetching the ids then the titles is longer but doesn't depend on a
 * name Postgres chose for us.
 *
 * Best-effort — on a read failure it returns [] so the caller still falls back
 * to a generic message instead of throwing over a nicety.
 */
async function getCombosUsingProduct(
  supabase: ReturnType<typeof createAdminClient>,
  productId: string,
): Promise<string[]> {
  const { data: items, error } = await supabase
    .from("combo_items")
    .select("combo_id")
    .eq("component_id", productId);
  if (error || !items?.length) return [];

  const comboIds = [
    ...new Set((items as { combo_id: string }[]).map((i) => i.combo_id)),
  ];
  const { data: combos } = await supabase
    .from("products")
    .select("title")
    .in("id", comboIds);

  return ((combos ?? []) as { title: string }[]).map((c) => c.title);
}

/** Plain-language "why you can't delete this yet", naming the combos. */
function comboBlockedMessage(comboTitles: string[]): string {
  if (comboTitles.length === 0) {
    return "This product is part of a combo. Delete the combo first, then delete this product.";
  }
  // Name a few, then summarise — a product in a dozen combos shouldn't produce
  // a toast the user has to scroll.
  const shown = comboTitles.slice(0, 3).join(", ");
  const rest = comboTitles.length - 3;
  const list = rest > 0 ? `${shown} and ${rest} more` : shown;
  const combo = comboTitles.length === 1 ? "the combo" : "the combos";
  return `This product is used in ${combo} ${list}. Delete ${comboTitles.length === 1 ? "that combo" : "those combos"} first, then delete this product.`;
}

export async function deleteProduct(
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requirePermission("products.delete");
    const supabase = createAdminClient();

    // Refuse early if this product is a component of any combo.
    //
    // combo_items.component_id is ON DELETE RESTRICT — the only such FK onto
    // products — so without this the delete fails deep in Postgres and the user
    // gets a raw "violates foreign key constraint combo_items_component_id_fkey"
    // that says nothing about what to do. Checking up front also keeps the
    // audit row below from being written for a delete that never happens.
    const blockingCombos = await getCombosUsingProduct(supabase, productId);
    if (blockingCombos.length > 0) {
      return { success: false, error: comboBlockedMessage(blockingCombos) };
    }

    // Log a deletion audit row (with last-known total stock) BEFORE removing, so
    // the record survives. FKs on stock_movements are SET NULL, and the title is
    // snapshotted, so the entry stays readable after the product is gone.
    const { data: existing } = await supabase
      .from("products")
      .select("title, stock_quantity")
      .eq("id", productId)
      .single();
    if (existing) {
      const p = existing as { title: string; stock_quantity: number };
      await supabase.from("stock_movements").insert({
        type: "deletion",
        product_id: productId,
        product_title: p.title,
        quantity: p.stock_quantity,
        created_by: ctx.userId,
        created_by_email: ctx.email,
      });
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      // A combo could have been built from this product in the moment between
      // the check above and here. 23503 is Postgres's foreign-key violation,
      // and component_id is the only RESTRICT FK onto products, so this can
      // only be a combo — re-read them to name it rather than leaking the
      // constraint text.
      if (error.code === "23503") {
        const combos = await getCombosUsingProduct(supabase, productId);
        return { success: false, error: comboBlockedMessage(combos) };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
