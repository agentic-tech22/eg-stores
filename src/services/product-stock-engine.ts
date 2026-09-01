/**
 * Product stock engine: helpers that write a product's on-hand stock. NOT a
 * "use server" module, so these take a Supabase client argument and can be
 * exercised directly by tests (mirrors `sale-engine` / `order-engine`).
 *
 * Stock model: on-hand lives per warehouse in `warehouse_stock`, never as a
 * column on `products` / `product_variants`. Every write goes through the
 * atomic `set_warehouse_stock` RPC, which also keeps the cached row total in
 * sync, so nothing here touches those columns directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/types/user.types";

/**
 * Which conversion, if any, a product save performs. A product holds stock in
 * exactly one shape at a time: either on the product row (simple) or spread
 * across its variants. Flipping between them strands whatever the outgoing
 * shape was holding, so callers must retire it.
 *
 * `nextHasVariants` is the submitted value, which is `undefined` when the save
 * doesn't touch the shape at all. That must read as "unchanged", not as "make
 * it simple", or an unrelated edit (a price tweak, say) would wipe every
 * variant's stock.
 */
export function planShapeChange(args: {
  wasVariantProduct: boolean;
  nextHasVariants: boolean | undefined;
}): {
  becomesVariantProduct: boolean;
  convertingToVariants: boolean;
  convertingToSimple: boolean;
} {
  const becomesVariantProduct = args.nextHasVariants ?? args.wasVariantProduct;
  return {
    becomesVariantProduct,
    convertingToVariants: !args.wasVariantProduct && becomesVariantProduct,
    convertingToSimple: args.wasVariantProduct && !becomesVariantProduct,
  };
}

/**
 * Set a product/variant's on-hand stock in one warehouse via the atomic
 * `set_warehouse_stock` RPC and, when `logEdit` is set and the count actually
 * changed, append a `stock_movements` 'edit' audit row.
 */
export async function setWarehouseStockAndLog(
  supabase: SupabaseClient,
  args: {
    warehouseId: string;
    productId: string;
    variantId: string | null;
    newQty: number;
    productTitle: string | null;
    variantLabel: string | null;
    ctx: AuthContext;
    logEdit: boolean;
  },
): Promise<void> {
  let query = supabase
    .from("warehouse_stock")
    .select("stock_quantity")
    .eq("warehouse_id", args.warehouseId)
    .eq("product_id", args.productId);
  query = args.variantId
    ? query.eq("variant_id", args.variantId)
    : query.is("variant_id", null);
  const { data: existing } = await query.maybeSingle();
  const oldQty =
    (existing as { stock_quantity: number } | null)?.stock_quantity ?? 0;
  const newQty = Math.max(0, Math.trunc(args.newQty));

  await supabase.rpc("set_warehouse_stock", {
    p_warehouse_id: args.warehouseId,
    p_product_id: args.productId,
    p_variant_id: args.variantId,
    p_new_qty: newQty,
  });

  if (args.logEdit && oldQty !== newQty) {
    await supabase.from("stock_movements").insert({
      type: "edit",
      product_id: args.productId,
      variant_id: args.variantId,
      product_title: args.productTitle,
      variant_label: args.variantLabel,
      warehouse_id: args.warehouseId,
      old_value: oldQty,
      new_value: newQty,
      created_by: args.ctx.userId,
      created_by_email: args.ctx.email,
    });
  }
}

/**
 * Zero a product's (or one variant's) on-hand stock in EVERY warehouse holding
 * it, logging each as an audited 'edit'.
 *
 * Used when a row stops being a stock-bearing thing: converting a simple product
 * to variants, converting back, or removing a variant. Without this the
 * `warehouse_stock` rows outlive their owner, so the units stop being counted by
 * the product yet still sit in per-warehouse reports. That is where the phantom
 * on-hand figures came from.
 *
 * Every warehouse is swept, not just the default: stock can sit anywhere, and
 * retiring only the default would leave the rest orphaned exactly as before.
 *
 * @returns the warehouse ids that actually held stock and were zeroed.
 */
export async function retireStock(
  supabase: SupabaseClient,
  args: {
    productId: string;
    /** Null retires the product-level rows; an id retires that variant's. */
    variantId: string | null;
    productTitle: string | null;
    variantLabel: string | null;
    ctx: AuthContext;
  },
): Promise<string[]> {
  let query = supabase
    .from("warehouse_stock")
    .select("warehouse_id, stock_quantity")
    .eq("product_id", args.productId)
    .gt("stock_quantity", 0);
  query = args.variantId
    ? query.eq("variant_id", args.variantId)
    : query.is("variant_id", null);

  const { data } = await query;
  const rows = (data ?? []) as {
    warehouse_id: string;
    stock_quantity: number;
  }[];

  for (const row of rows) {
    await setWarehouseStockAndLog(supabase, {
      warehouseId: row.warehouse_id,
      productId: args.productId,
      variantId: args.variantId,
      newQty: 0,
      productTitle: args.productTitle,
      variantLabel: args.variantLabel,
      ctx: args.ctx,
      // Always audited: the units are leaving the product, so they must appear
      // in its History rather than silently vanishing.
      logEdit: true,
    });
  }

  return rows.map((r) => r.warehouse_id);
}
