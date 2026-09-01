"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { ctxHasPermission, requirePermission } from "@/lib/auth/session";
import { recordPriceChanges } from "@/lib/products/price-history";
import { getPriceChanges, getStockEntries } from "@/queries/restock.query";
import { getDefaultWarehouseId } from "@/queries/warehouse.query";
import { mapStockMovementRow } from "@/services/warehouse-engine";
import type {
  PriceChange,
  PriceChangeRow,
  ProductHistory,
  StockEntry,
  StockEntryRow,
} from "@/types/product.types";
import type { StockMovementRow } from "@/types/warehouse.types";

function mapStockEntry(row: StockEntryRow, canViewFinance: boolean): StockEntry {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    // Cost is financial: withhold it from callers without the grant.
    unitCost: canViewFinance ? row.unit_cost : null,
    note: row.note,
    warehouseId: row.warehouse_id ?? null,
    warehouseName: null,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

function mapPriceChange(row: PriceChangeRow): PriceChange {
  return {
    id: row.id,
    productId: row.product_id,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

/**
 * Restock a product: add a positive batch of imported units and append a
 * ledger entry recording the quantity, per-unit cost, and who/when. Optionally
 * promotes that unit cost to the product's cost price (logged as a price
 * change). Stock-only fields are bumped atomically via the stock-adjust RPCs.
 */
export async function restockProduct(input: {
  productId: string;
  /** Set when the units belong to a specific variant of a variant product. */
  variantId?: string | null;
  /** Warehouse to restock into; defaults to the default warehouse. */
  warehouseId?: string | null;
  quantity: number;
  /** Per-unit supplier cost; recorded only for finance-permitted callers. */
  unitCost?: number | null;
  note?: string | null;
  /** When true, set the product's cost price to `unitCost`. */
  setAsCostPrice?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requirePermission("products.edit");
    const canViewFinance = ctxHasPermission(ctx, "finances.view");

    const quantity = Math.trunc(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: "Quantity must be a positive whole number." };
    }

    const warehouseId = input.warehouseId || (await getDefaultWarehouseId());
    if (!warehouseId) {
      return { success: false, error: "No warehouse is configured." };
    }

    // Cost is financial: ignore any submitted cost for callers who can't see it.
    const unitCost =
      canViewFinance && input.unitCost != null && input.unitCost >= 0
        ? input.unitCost
        : null;
    const setAsCostPrice = Boolean(input.setAsCostPrice) && unitCost != null;

    const supabase = createAdminClient();

    // Validate the cost-price promotion against the selling price before we
    // mutate any stock, so a rejected price never half-applies.
    let currentCostPrice: number | null = null;
    if (setAsCostPrice) {
      const { data: current, error } = await supabase
        .from("products")
        .select("price, cost_price")
        .eq("id", input.productId)
        .single();
      const c = current as { price: number; cost_price: number } | null;
      if (error || !c) {
        return { success: false, error: "Product not found." };
      }
      if (unitCost! > c.price) {
        return {
          success: false,
          error: "Cost price cannot be greater than the selling price.",
        };
      }
      currentCostPrice = c.cost_price;
    }

    // Bump the on-hand stock counter for the chosen warehouse via the atomic
    // upserting RPC (also mirrors the cached product/variant total).
    const { error: stockError } = await supabase.rpc("adjust_warehouse_stock", {
      p_warehouse_id: warehouseId,
      p_product_id: input.productId,
      p_variant_id: input.variantId ?? null,
      p_delta: quantity,
    });
    if (stockError) {
      return { success: false, error: stockError.message };
    }

    const { error: entryError } = await supabase
      .from("product_stock_entries")
      .insert({
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        warehouse_id: warehouseId,
        quantity,
        unit_cost: unitCost,
        note: input.note?.trim() || null,
        created_by: ctx.userId,
        created_by_email: ctx.email,
      });
    if (entryError) {
      // Roll the stock bump back so the ledger and counter stay consistent.
      await supabase.rpc("adjust_warehouse_stock", {
        p_warehouse_id: warehouseId,
        p_product_id: input.productId,
        p_variant_id: input.variantId ?? null,
        p_delta: -quantity,
      });
      return { success: false, error: entryError.message };
    }

    // Promote the unit cost to the product's cost price, logging the change.
    if (setAsCostPrice && unitCost !== currentCostPrice) {
      await supabase
        .from("products")
        .update({ cost_price: unitCost, updated_at: new Date().toISOString() })
        .eq("id", input.productId);
      await recordPriceChanges(
        supabase,
        input.productId,
        [{ field: "cost_price", oldValue: currentCostPrice, newValue: unitCost! }],
        { userId: ctx.userId, email: ctx.email },
      );
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * The restock ledger and price-change history for a product. Cost data is
 * redacted for callers without `finances.view`: restock unit costs are nulled
 * and cost-price changes are omitted (selling-price changes are public).
 */
export async function fetchProductHistory(
  productId: string,
): Promise<ProductHistory> {
  const ctx = await requirePermission("products.view");
  const canViewFinance = ctxHasPermission(ctx, "finances.view");

  const supabase = createAdminClient();
  const [stockRows, priceRows, movementRes, warehouseRes] = await Promise.all([
    getStockEntries(productId),
    getPriceChanges(productId),
    supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    supabase.from("warehouses").select("id, name"),
  ]);

  const warehouseNames = new Map(
    ((warehouseRes.data ?? []) as { id: string; name: string }[]).map((w) => [
      w.id,
      w.name,
    ]),
  );

  const restocks = stockRows.map((r) => {
    const entry = mapStockEntry(r, canViewFinance);
    return {
      ...entry,
      warehouseName: entry.warehouseId
        ? (warehouseNames.get(entry.warehouseId) ?? null)
        : null,
    };
  });
  const priceChanges = priceRows
    .filter((r) => canViewFinance || r.field === "price")
    .map(mapPriceChange);
  const movements = ((movementRes.data ?? []) as StockMovementRow[]).map((r) =>
    mapStockMovementRow(r, warehouseNames),
  );

  return { restocks, priceChanges, movements };
}
