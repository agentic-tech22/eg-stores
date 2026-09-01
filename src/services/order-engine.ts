/**
 * Order stock engine: pure helpers shared by the order service, the NCM
 * service, and the webhook route. NOT a "use server" module, so these can take
 * a Supabase client argument and run inside route handlers.
 *
 * Stock model: `reserve` on order placement, `commit` (deduct) on delivery,
 * `release` on cancellation before delivery. Each line routes to the variant
 * or product RPC depending on whether it has a `product_variant_id`.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderItem,
  OrderItemRow,
  OrderRow,
  OrderStatus,
} from "@/types/order.types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

export function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productVariantId: row.product_variant_id,
    comboId: row.combo_id,
    productTitle: row.product_title,
    variantLabel: row.variant_label,
    sku: row.sku,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    createdAt: row.created_at,
  };
}

export function mapOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerPhone2: row.customer_phone2,
    customerAddress: row.customer_address,
    status: row.status,
    source: row.source,
    warehouseId: row.warehouse_id,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    esewaTransactionCode: row.esewa_transaction_code,
    esewaTransactionUuid: row.esewa_transaction_uuid,
    subtotal: row.subtotal,
    codCharge: row.cod_charge,
    total: row.total,
    notes: row.notes,
    ncmOrderId: row.ncm_order_id,
    ncmStatus: row.ncm_status,
    ncmFromBranch: row.ncm_from_branch,
    ncmToBranch: row.ncm_to_branch,
    ncmDeliveryType: row.ncm_delivery_type,
    ncmSyncedAt: row.ncm_synced_at,
    ncmShippedAt: row.ncm_shipped_at,
    ncmDeliveredAt: row.ncm_delivered_at,
    stockCommitted: row.stock_committed,
    stockReleased: row.stock_released,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.order_items?.map(mapOrderItemRow),
    convertedSale: mapConvertedSale(row.converted_sale),
  };
}

/** Normalize the converted-sale embed (object | array | null) to a flat value. */
function mapConvertedSale(
  embed: OrderRow["converted_sale"],
): Order["convertedSale"] {
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row ? { id: row.id, saleNumber: row.sale_number } : null;
}

/**
 * A line resolved against the catalog: validated, priced, ready to persist.
 *
 * Combos expand into multiple resolved lines: one **header** line carrying the
 * combo title/price with `productId = null` (no stock), plus one line per
 * component with a real `productId`, `unitPrice = 0`, and the component stock to
 * reserve. Both share `comboId`. A line with neither `productId` nor
 * `productVariantId` bears no stock and is skipped by the reserve/commit/release
 * helpers.
 */
export interface ResolvedLine {
  productId: string | null;
  productVariantId: string | null;
  comboId: string | null;
  productTitle: string;
  variantLabel: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LineRequest {
  productId: string;
  productVariantId?: string | null;
  quantity: number;
}

/**
 * Validate each requested line against the catalog and compute its price from
 * the variant override or product price. Prices are always taken server-side:
 * client-supplied amounts are ignored.
 */
export async function resolveLines(
  supabase: SupabaseClient,
  lines: LineRequest[],
): Promise<{ items?: ResolvedLine[]; error?: string }> {
  if (!lines.length) return { error: "Add at least one item." };
  const items: ResolvedLine[] = [];

  for (const line of lines) {
    const qty = Math.floor(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: "Quantities must be whole numbers greater than zero." };
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, title, price, has_variants, is_combo, sku")
      .eq("id", line.productId)
      .single();

    if (!product) return { error: "One or more products no longer exist." };
    const p = product as {
      id: string;
      title: string;
      price: number;
      has_variants: boolean;
      is_combo: boolean;
      sku: string;
    };

    if (p.is_combo) {
      // Expand the combo into a priced header line (no stock) plus zero-priced
      // component lines that carry the real stock to reserve/commit/release.
      const { data: comboItems } = await supabase
        .from("combo_items")
        .select("component_id, quantity")
        .eq("combo_id", p.id);
      const compRows = (comboItems ?? []) as {
        component_id: string;
        quantity: number;
      }[];
      if (compRows.length === 0) {
        return { error: `"${p.title}" is not available.` };
      }

      const { data: compProducts } = await supabase
        .from("products")
        .select("id, title, sku")
        .in("id", compRows.map((r) => r.component_id));
      const compById = new Map(
        ((compProducts ?? []) as { id: string; title: string; sku: string }[]).map(
          (c) => [c.id, c],
        ),
      );

      // Header line: combo price, counted once; bears no stock. Carries the
      // combo's own base SKU (it's the product the customer actually bought, and
      // this is what survives the order→sale conversion).
      items.push({
        productId: null,
        productVariantId: null,
        comboId: p.id,
        productTitle: p.title,
        variantLabel: null,
        sku: p.sku,
        quantity: qty,
        unitPrice: p.price,
        lineTotal: p.price * qty,
      });

      for (const r of compRows) {
        const comp = compById.get(r.component_id);
        if (!comp) {
          return { error: `A component of "${p.title}" no longer exists.` };
        }
        items.push({
          productId: r.component_id,
          productVariantId: null,
          comboId: p.id,
          productTitle: comp.title,
          variantLabel: null,
          sku: comp.sku,
          quantity: qty * r.quantity,
          unitPrice: 0,
          lineTotal: 0,
        });
      }
      continue;
    }

    if (line.productVariantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("id, product_id, display_name, price_override, archived, sku")
        .eq("id", line.productVariantId)
        .single();
      const v = variant as {
        id: string;
        product_id: string;
        display_name: string;
        price_override: number | null;
        archived: boolean;
        sku: string | null;
      } | null;
      if (!v || v.product_id !== p.id || v.archived) {
        return { error: `Selected variant for "${p.title}" is unavailable.` };
      }
      const unitPrice = v.price_override ?? p.price;
      items.push({
        productId: p.id,
        productVariantId: v.id,
        comboId: null,
        productTitle: p.title,
        variantLabel: v.display_name,
        sku: v.sku ?? p.sku,
        quantity: qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });
    } else {
      if (p.has_variants) {
        return { error: `Please choose a variant for "${p.title}".` };
      }
      items.push({
        productId: p.id,
        productVariantId: null,
        comboId: null,
        productTitle: p.title,
        variantLabel: null,
        sku: p.sku,
        quantity: qty,
        unitPrice: p.price,
        lineTotal: p.price * qty,
      });
    }
  }

  return { items };
}

// A line with neither variant nor product (a combo header) bears no stock.
type StockLine = {
  productId: string | null;
  productVariantId: string | null;
  quantity: number;
};

async function reserveOne(
  supabase: SupabaseClient,
  line: StockLine,
  warehouseId: string,
): Promise<boolean> {
  if (line.productVariantId) {
    const { data } = await supabase.rpc("reserve_variant_stock", {
      p_warehouse_id: warehouseId,
      p_variant_id: line.productVariantId,
      p_qty: line.quantity,
    });
    return data === true;
  }
  if (!line.productId) return true; // combo header, nothing to reserve
  const { data } = await supabase.rpc("reserve_stock", {
    p_warehouse_id: warehouseId,
    p_product_id: line.productId,
    p_qty: line.quantity,
  });
  return data === true;
}

async function releaseOne(
  supabase: SupabaseClient,
  line: StockLine,
  warehouseId: string,
): Promise<void> {
  if (line.productVariantId) {
    await supabase.rpc("release_variant_stock", {
      p_warehouse_id: warehouseId,
      p_variant_id: line.productVariantId,
      p_qty: line.quantity,
    });
  } else if (line.productId) {
    await supabase.rpc("release_stock", {
      p_warehouse_id: warehouseId,
      p_product_id: line.productId,
      p_qty: line.quantity,
    });
  }
}

async function commitOne(
  supabase: SupabaseClient,
  line: StockLine,
  warehouseId: string,
): Promise<void> {
  if (line.productVariantId) {
    await supabase.rpc("commit_variant_stock", {
      p_warehouse_id: warehouseId,
      p_variant_id: line.productVariantId,
      p_qty: line.quantity,
    });
  } else if (line.productId) {
    await supabase.rpc("commit_stock", {
      p_warehouse_id: warehouseId,
      p_product_id: line.productId,
      p_qty: line.quantity,
    });
  }
}

/**
 * Reserve every line atomically-ish: if any line lacks stock, the lines already
 * reserved in this call are released so we never leave a partial reservation.
 * All lines reserve against the order's single header `warehouseId`.
 */
export async function reserveLines(
  supabase: SupabaseClient,
  lines: ResolvedLine[],
  warehouseId: string,
): Promise<{ error?: string }> {
  const reserved: ResolvedLine[] = [];
  for (const line of lines) {
    const ok = await reserveOne(supabase, line, warehouseId);
    if (!ok) {
      for (const r of reserved) await releaseOne(supabase, r, warehouseId);
      const label = line.variantLabel
        ? `${line.productTitle} (${line.variantLabel})`
        : line.productTitle;
      return { error: `Insufficient stock for ${label}.` };
    }
    reserved.push(line);
  }
  return {};
}

export async function releaseLines(
  supabase: SupabaseClient,
  lines: ResolvedLine[],
  warehouseId: string,
): Promise<void> {
  for (const line of lines) await releaseOne(supabase, line, warehouseId);
}

/**
 * Reserve every line independently, never failing the whole batch. Used for
 * already-paid orders (e.g. eSewa) where the money is captured and the order
 * must be honored even if a line ran out of stock between payment initiation
 * and the success callback. Returns the lines that could not be reserved so the
 * caller can flag them for manual restocking.
 */
export async function reserveLinesBestEffort(
  supabase: SupabaseClient,
  lines: ResolvedLine[],
  warehouseId: string,
): Promise<{ unreserved: ResolvedLine[] }> {
  const unreserved: ResolvedLine[] = [];
  for (const line of lines) {
    const ok = await reserveOne(supabase, line, warehouseId);
    if (!ok) unreserved.push(line);
  }
  return { unreserved };
}

function itemsFromRow(row: OrderRow): ResolvedLine[] {
  return (row.order_items ?? []).map((it) => ({
    productId: it.product_id,
    productVariantId: it.product_variant_id,
    comboId: it.combo_id,
    productTitle: it.product_title,
    variantLabel: it.variant_label,
    sku: it.sku,
    quantity: it.quantity,
    unitPrice: it.unit_price,
    lineTotal: it.line_total,
  }));
}

/**
 * Move an order to `newStatus`, applying the stock side-effects exactly once:
 *   delivered  → commit (deduct) stock, mark stock_committed
 *   cancelled  → release reserved stock (only if not yet committed), mark stock_released
 * Other statuses just update the field. Idempotent via the stock flags.
 * Extra column updates (e.g. ncm_status) can be merged via `extra`.
 */
export async function applyStatusTransition(
  supabase: SupabaseClient,
  order: OrderRow,
  newStatus: OrderStatus,
  extra: Record<string, unknown> = {},
): Promise<{ error?: string }> {
  const lines = itemsFromRow(order);
  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...extra,
  };

  if (newStatus === "delivered" && !order.stock_committed) {
    for (const line of lines) await commitOne(supabase, line, order.warehouse_id);
    updates.stock_committed = true;
    if (!order.ncm_delivered_at) updates.ncm_delivered_at = new Date().toISOString();
  }

  if (
    newStatus === "cancelled" &&
    !order.stock_released &&
    !order.stock_committed
  ) {
    for (const line of lines) await releaseOne(supabase, line, order.warehouse_id);
    updates.stock_released = true;
  }

  const { error } = await supabase.from("orders").update(updates).eq("id", order.id);
  return error ? { error: error.message } : {};
}

/** Manual restock of a delivered+returned order (no auto-restock on return). */
export async function restockOrderItems(
  supabase: SupabaseClient,
  order: OrderRow,
): Promise<void> {
  for (const line of itemsFromRow(order)) {
    if (!line.productId && !line.productVariantId) continue; // combo header
    await supabase.rpc("adjust_warehouse_stock", {
      p_warehouse_id: order.warehouse_id,
      p_product_id: line.productId,
      p_variant_id: line.productVariantId,
      p_delta: line.quantity,
    });
  }
}
