import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadTestEnv } from "./env";

loadTestEnv();

/**
 * A service-role Supabase client pointed at the LOCAL test database. Built
 * directly from `@supabase/supabase-js` (not the app's request-scoped client)
 * so it needs no `next/headers` context. Service role bypasses RLS, matching how
 * the engines run in production via `createAdminClient`.
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run `pnpm test:db:up` or create .env.test (see .env.test.example).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface SeededProduct {
  warehouseId: string;
  productId: string;
}

/**
 * Seed one warehouse + one simple (non-variant) product with a known stock level
 * in that warehouse. Returns the ids so a test can act and assert on them.
 * Uses a unique title/sku per call so parallel-safe and idempotent.
 */
export async function seedProductWithStock(
  db: SupabaseClient,
  opts: { stock: number; reserved?: number; price?: number; costPrice?: number },
): Promise<SeededProduct> {
  const tag = `test-${Date.now()}-${Math.floor(process.hrtime()[1])}`;

  const { data: wh, error: whErr } = await db
    .from("warehouses")
    .insert({ name: `WH ${tag}` })
    .select("id")
    .single();
  if (whErr) throw whErr;

  const { data: prod, error: prodErr } = await db
    .from("products")
    .insert({
      title: `Product ${tag}`,
      price: opts.price ?? 100,
      cost_price: opts.costPrice ?? 40,
      has_variants: false,
      stock_quantity: opts.stock,
    })
    .select("id")
    .single();
  if (prodErr) throw prodErr;

  const { error: stockErr } = await db.from("warehouse_stock").insert({
    warehouse_id: wh.id,
    product_id: prod.id,
    variant_id: null,
    stock_quantity: opts.stock,
    reserved_quantity: opts.reserved ?? 0,
  });
  if (stockErr) throw stockErr;

  return { warehouseId: wh.id, productId: prod.id };
}

/** Read the current warehouse stock for a seeded product. */
export async function warehouseStock(
  db: SupabaseClient,
  { warehouseId, productId }: SeededProduct,
): Promise<{ stock: number; reserved: number }> {
  const { data, error } = await db
    .from("warehouse_stock")
    .select("stock_quantity, reserved_quantity")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .is("variant_id", null)
    .single();
  if (error) throw error;
  return { stock: data.stock_quantity, reserved: data.reserved_quantity };
}

/** Remove a seeded warehouse + product (cascades warehouse_stock). */
export async function cleanupSeed(
  db: SupabaseClient,
  seed: SeededProduct,
): Promise<void> {
  await db.from("warehouse_stock").delete().eq("product_id", seed.productId);
  await db.from("products").delete().eq("id", seed.productId);
  await db.from("warehouses").delete().eq("id", seed.warehouseId);
}

/** A product seeded across several warehouses, optionally with variants. */
export interface SeededMultiWarehouse {
  productId: string;
  warehouseIds: string[];
  /** Variant ids, in the order requested. Empty for a simple product. */
  variantIds: string[];
}

/**
 * Seed one product spread over N warehouses, so a test can prove that stock is
 * retired EVERYWHERE and not just in the default warehouse. When `variants` is
 * given the product is a variant product and each variant is stocked in every
 * warehouse; otherwise the stock sits on the product itself.
 */
export async function seedAcrossWarehouses(
  db: SupabaseClient,
  opts: {
    warehouses: number;
    /** Stock placed in each warehouse, for the product or for each variant. */
    stockPerWarehouse: number;
    /** Variant display names. Omit or leave empty for a simple product.  */
    variants?: string[];
  },
): Promise<SeededMultiWarehouse> {
  const tag = `test-${Date.now()}-${Math.floor(process.hrtime()[1])}`;
  const variantNames = opts.variants ?? [];
  const hasVariants = variantNames.length > 0;

  const warehouseIds: string[] = [];
  for (let i = 0; i < opts.warehouses; i++) {
    const { data, error } = await db
      .from("warehouses")
      .insert({ name: `WH ${tag}-${i}` })
      .select("id")
      .single();
    if (error) throw error;
    warehouseIds.push(data.id);
  }

  const { data: prod, error: prodErr } = await db
    .from("products")
    .insert({
      title: `Product ${tag}`,
      price: 100,
      cost_price: 40,
      has_variants: hasVariants,
      stock_quantity: hasVariants ? 0 : opts.stockPerWarehouse * opts.warehouses,
    })
    .select("id")
    .single();
  if (prodErr) throw prodErr;

  const variantIds: string[] = [];
  for (const displayName of variantNames) {
    const { data, error } = await db
      .from("product_variants")
      .insert({
        product_id: prod.id,
        attributes: { Name: displayName },
        display_name: displayName,
        stock_quantity: opts.stockPerWarehouse * opts.warehouses,
      })
      .select("id")
      .single();
    if (error) throw error;
    variantIds.push(data.id);
  }

  const stockRows: {
    warehouse_id: string;
    product_id: string;
    variant_id: string | null;
    stock_quantity: number;
    reserved_quantity: number;
  }[] = warehouseIds.flatMap((warehouseId) => {
    const targets: (string | null)[] = hasVariants ? variantIds : [null];
    return targets.map((variantId) => ({
      warehouse_id: warehouseId,
      product_id: prod.id as string,
      variant_id: variantId,
      stock_quantity: opts.stockPerWarehouse,
      reserved_quantity: 0,
    }));
  });
  const { error: stockErr } = await db.from("warehouse_stock").insert(stockRows);
  if (stockErr) throw stockErr;

  return { productId: prod.id, warehouseIds, variantIds };
}

/** Every warehouse_stock row for a product, for whole-product assertions. */
export async function allStockRows(
  db: SupabaseClient,
  productId: string,
): Promise<
  { warehouseId: string; variantId: string | null; stock: number }[]
> {
  const { data, error } = await db
    .from("warehouse_stock")
    .select("warehouse_id, variant_id, stock_quantity")
    .eq("product_id", productId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    warehouseId: r.warehouse_id,
    variantId: r.variant_id,
    stock: r.stock_quantity,
  }));
}

/** Audited 'edit' movements recorded against a product. */
export async function stockEditMovements(
  db: SupabaseClient,
  productId: string,
): Promise<{ variantId: string | null; oldValue: number; newValue: number }[]> {
  const { data, error } = await db
    .from("stock_movements")
    .select("variant_id, old_value, new_value")
    .eq("product_id", productId)
    .eq("type", "edit");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    variantId: r.variant_id,
    oldValue: r.old_value,
    newValue: r.new_value,
  }));
}

/** Remove everything seeded by `seedAcrossWarehouses`. */
export async function cleanupMultiWarehouse(
  db: SupabaseClient,
  seed: SeededMultiWarehouse,
): Promise<void> {
  await db.from("stock_movements").delete().eq("product_id", seed.productId);
  await db.from("warehouse_stock").delete().eq("product_id", seed.productId);
  await db.from("product_variants").delete().eq("product_id", seed.productId);
  await db.from("products").delete().eq("id", seed.productId);
  for (const id of seed.warehouseIds) {
    await db.from("warehouses").delete().eq("id", id);
  }
}
