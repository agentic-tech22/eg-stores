"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { ctxHasPermission, requirePermission } from "@/lib/auth/session";
import { getWarehouses } from "@/queries/warehouse.query";
import { mapStockMovementRow, mapWarehouseRow } from "@/services/warehouse-engine";
import type {
  StockMovement,
  StockMovementRow,
  TransferStockInput,
  Warehouse,
  WarehouseStockValue,
} from "@/types/warehouse.types";

type Result = { success: boolean; error?: string };

/** All warehouses, default first. Shared with pickers and the storefront. */
export async function fetchWarehouses(): Promise<Warehouse[]> {
  const rows = await getWarehouses();
  return rows.map(mapWarehouseRow);
}

/** The default warehouse (or null when none is configured). */
export async function fetchDefaultWarehouse(): Promise<Warehouse | null> {
  const rows = await getWarehouses();
  const row = rows.find((r) => r.is_default && r.is_active);
  return row ? mapWarehouseRow(row) : null;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createWarehouse(data: {
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
}): Promise<Result> {
  try {
    await requirePermission("warehouses.create");
    const name = data.name.trim();
    if (!name) return { success: false, error: "Warehouse name is required." };

    const supabase = createAdminClient();
    const { error } = await supabase.from("warehouses").insert({
      name,
      code: cleanText(data.code),
      address: cleanText(data.address),
      phone: cleanText(data.phone),
      is_active: data.isActive ?? true,
    });

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A warehouse with that code already exists."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateWarehouse(
  warehouseId: string,
  data: {
    name?: string;
    code?: string | null;
    address?: string | null;
    phone?: string | null;
    isActive?: boolean;
  },
): Promise<Result> {
  try {
    await requirePermission("warehouses.edit");
    const supabase = createAdminClient();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) return { success: false, error: "Warehouse name is required." };
      update.name = name;
    }
    if (data.code !== undefined) update.code = cleanText(data.code);
    if (data.address !== undefined) update.address = cleanText(data.address);
    if (data.phone !== undefined) update.phone = cleanText(data.phone);
    if (data.isActive !== undefined) update.is_active = data.isActive;

    const { error } = await supabase
      .from("warehouses")
      .update(update)
      .eq("id", warehouseId);

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A warehouse with that code already exists."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Make one warehouse the default (clears the previous default atomically). */
export async function setDefaultWarehouse(warehouseId: string): Promise<Result> {
  try {
    await requirePermission("warehouses.edit");
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("set_default_warehouse", { p_id: warehouseId });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteWarehouse(warehouseId: string): Promise<Result> {
  try {
    await requirePermission("warehouses.delete");
    const supabase = createAdminClient();

    const { data: wh } = await supabase
      .from("warehouses")
      .select("is_default")
      .eq("id", warehouseId)
      .single();
    if ((wh as { is_default: boolean } | null)?.is_default) {
      return { success: false, error: "The default warehouse cannot be deleted." };
    }

    // Refuse if it still holds any stock (on-hand or reserved).
    const { data: held } = await supabase
      .from("warehouse_stock")
      .select("id, stock_quantity, reserved_quantity")
      .eq("warehouse_id", warehouseId);
    const hasStock = ((held ?? []) as {
      stock_quantity: number;
      reserved_quantity: number;
    }[]).some((r) => r.stock_quantity > 0 || r.reserved_quantity > 0);
    if (hasStock) {
      return {
        success: false,
        error: "This warehouse still holds stock. Transfer it out first, or deactivate the warehouse instead.",
      };
    }

    // Clear any empty stock rows so the RESTRICT FK doesn't block deletion.
    await supabase.from("warehouse_stock").delete().eq("warehouse_id", warehouseId);

    const { error } = await supabase.from("warehouses").delete().eq("id", warehouseId);
    if (error) {
      const message = /foreign key|violates/i.test(error.message)
        ? "This warehouse is referenced by existing orders or sales and cannot be deleted. Deactivate it instead."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Move a chosen quantity of a product/variant between warehouses (logged). */
export async function transferStock(input: TransferStockInput): Promise<Result> {
  try {
    const ctx = await requirePermission("warehouses.edit");

    const quantity = Math.trunc(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: "Quantity must be a positive whole number." };
    }
    if (!input.fromWarehouseId || !input.toWarehouseId) {
      return { success: false, error: "Choose both a source and destination warehouse." };
    }
    if (input.fromWarehouseId === input.toWarehouseId) {
      return { success: false, error: "Source and destination must be different." };
    }

    const supabase = createAdminClient();
    const variantId = input.productVariantId ?? null;

    // Snapshot labels for the audit row.
    const { data: product } = await supabase
      .from("products")
      .select("title")
      .eq("id", input.productId)
      .single();
    let variantLabel: string | null = null;
    if (variantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("display_name")
        .eq("id", variantId)
        .single();
      variantLabel = (variant as { display_name: string } | null)?.display_name ?? null;
    }

    const { data: moved, error: rpcError } = await supabase.rpc("transfer_stock", {
      p_from: input.fromWarehouseId,
      p_to: input.toWarehouseId,
      p_product_id: input.productId,
      p_variant_id: variantId,
      p_qty: quantity,
    });
    if (rpcError) return { success: false, error: rpcError.message };
    if (moved !== true) {
      return {
        success: false,
        error: "Not enough free (unreserved) stock in the source warehouse.",
      };
    }

    const { error: logError } = await supabase.from("stock_movements").insert({
      type: "transfer",
      product_id: input.productId,
      variant_id: variantId,
      product_title: (product as { title: string } | null)?.title ?? null,
      variant_label: variantLabel,
      from_warehouse_id: input.fromWarehouseId,
      to_warehouse_id: input.toWarehouseId,
      quantity,
      note: cleanText(input.note),
      created_by: ctx.userId,
      created_by_email: ctx.email,
    });
    if (logError) {
      // Reverse the move so stock and ledger stay consistent.
      await supabase.rpc("transfer_stock", {
        p_from: input.toWarehouseId,
        p_to: input.fromWarehouseId,
        p_product_id: input.productId,
        p_variant_id: variantId,
        p_qty: quantity,
      });
      return { success: false, error: logError.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Recent stock movements (transfers, edits, deletions), newest first. */
export async function fetchStockMovements(limit = 100): Promise<StockMovement[]> {
  await requirePermission("warehouses.view");
  const supabase = createAdminClient();

  const [{ data: movementData }, { data: whData }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("warehouses").select("id, name"),
  ]);

  const warehouseNames = new Map(
    ((whData ?? []) as { id: string; name: string }[]).map((w) => [w.id, w.name]),
  );
  return ((movementData ?? []) as StockMovementRow[]).map((r) =>
    mapStockMovementRow(r, warehouseNames),
  );
}

/** On-hand units and (for finance viewers) cost value per warehouse. */
export async function fetchWarehouseStockValue(): Promise<WarehouseStockValue[]> {
  const ctx = await requirePermission("warehouses.view");
  const canViewFinance = ctxHasPermission(ctx, "finances.view");
  const supabase = createAdminClient();

  const [{ data: whData }, { data: stockData }, { data: productData }] =
    await Promise.all([
      supabase.from("warehouses").select("id, name").order("name"),
      supabase
        .from("warehouse_stock")
        .select("warehouse_id, product_id, stock_quantity"),
      supabase.from("products").select("id, cost_price"),
    ]);

  const costByProduct = new Map(
    ((productData ?? []) as { id: string; cost_price: number }[]).map((p) => [
      p.id,
      p.cost_price ?? 0,
    ]),
  );

  const byWarehouse = new Map<string, { units: number; costValue: number }>();
  for (const s of (stockData ?? []) as {
    warehouse_id: string;
    product_id: string;
    stock_quantity: number;
  }[]) {
    const entry = byWarehouse.get(s.warehouse_id) ?? { units: 0, costValue: 0 };
    entry.units += s.stock_quantity;
    entry.costValue += s.stock_quantity * (costByProduct.get(s.product_id) ?? 0);
    byWarehouse.set(s.warehouse_id, entry);
  }

  return ((whData ?? []) as { id: string; name: string }[]).map((w) => {
    const entry = byWarehouse.get(w.id) ?? { units: 0, costValue: 0 };
    return {
      warehouseId: w.id,
      warehouseName: w.name,
      units: entry.units,
      costValue: canViewFinance ? entry.costValue : null,
    };
  });
}
