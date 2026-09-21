"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getOrderById, getOrders } from "@/queries/order.query";
import { getDefaultWarehouseId } from "@/queries/warehouse.query";
import { clampDiscount, roundMoney } from "@/lib/pos/sale-payment";
import { SALE_CHANNELS } from "@/types/sale.types";
import {
  applyStatusTransition,
  mapOrderRow,
  releaseLines,
  reserveLines,
  reserveLinesBestEffort,
  resolveLines,
  restockOrderItems,
} from "@/services/order-engine";
import { orderDeleteBlocker } from "@/types/order.types";
import type {
  CreateOrderInput,
  Order,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  SaleChannel,
} from "@/types/order.types";

/** Payment metadata stamped onto an order at creation time. */
interface OrderPaymentInput {
  method: OrderPaymentMethod;
  status: OrderPaymentStatus;
  esewaTransactionCode?: string | null;
  esewaTransactionUuid?: string | null;
}

/**
 * Unlike the other validators here, an absent channel is not an error: it falls
 * back to 'online'. The storefront call sites pass none, and a client bundle
 * from before the channel shipped sends none either. An explicitly wrong value
 * is still rejected.
 */
function normalizeChannel(value: unknown): SaleChannel | null {
  if (value === undefined || value === null) return "online";
  return SALE_CHANNELS.some((c) => c.value === value)
    ? (value as SaleChannel)
    : null;
}

interface CreateOrderCoreOptions {
  source: "admin" | "storefront";
  /** How the customer bought. Storefront paths force 'online'. */
  channel?: SaleChannel;
  /** Defaults to cod / unpaid (the pay-on-delivery flow). */
  payment?: OrderPaymentInput;
  /**
   * When true the order is created even if stock can't be fully reserved
   * (reserve is best-effort). Used for already-paid online orders, where the
   * payment is captured and the order must be honored regardless of stock.
   */
  allowOversell?: boolean;
}

export async function fetchOrders(): Promise<Order[]> {
  await requirePermission("orders.view");
  const rows = await getOrders();
  return rows.map(mapOrderRow);
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  await requirePermission("orders.view");
  const row = await getOrderById(id);
  return row ? mapOrderRow(row) : null;
}

/** Display-safe order details shown on the storefront post-checkout screen. */
export interface OrderSummary {
  orderNumber: number;
  customerName: string;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  discountAmount: number;
  codCharge: number;
  total: number;
  items: {
    title: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
}

/**
 * Public, unauthenticated lookup of one order for the post-checkout confirmation
 * screen. Returns only display-safe fields, never courier/internal data. Safe to
 * expose without a permission check because the order id is an unguessable UUID
 * handed only to the shopper who just placed it.
 */
export async function fetchOrderSummary(id: string): Promise<OrderSummary | null> {
  if (!id) return null;
  const row = await getOrderById(id);
  if (!row) return null;
  const order = mapOrderRow(row);
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    codCharge: order.codCharge,
    total: order.total,
    // Hide combo component lines (combo_id set + a real product_id); the combo's
    // header line carries the title/price the shopper should see.
    items: (order.items ?? [])
      .filter((it) => !(it.comboId && it.productId))
      .map((it) => ({
        title: it.productTitle,
        variantLabel: it.variantLabel,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
  };
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

/**
 * Shared creation path for both admin and storefront orders. Resolves prices
 * server-side, reserves stock, then persists the order header + line items.
 * On any failure after reservation, the reserved stock is released and a
 * partially-created order is removed.
 */
async function createOrderCore(
  supabase: SupabaseClient,
  input: CreateOrderInput,
  options: CreateOrderCoreOptions,
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  const { source, payment, allowOversell = false } = options;

  const channel = normalizeChannel(options.channel);
  if (!channel) {
    return { success: false, error: "Choose a valid sales channel." };
  }

  if (!input.customerName?.trim() || !input.customerPhone?.trim()) {
    return { success: false, error: "Customer name and phone are required." };
  }
  if (!input.customerAddress?.trim()) {
    return { success: false, error: "A delivery address is required." };
  }

  // Admin orders may pick a warehouse; storefront orders (and any order without
  // one) fall back to the default warehouse.
  const warehouseId = input.warehouseId || (await getDefaultWarehouseId());
  if (!warehouseId) {
    return { success: false, error: "No warehouse is configured." };
  }

  const resolved = await resolveLines(supabase, input.items);
  if (resolved.error || !resolved.items) {
    return { success: false, error: resolved.error ?? "Invalid items." };
  }

  // Pay-on-delivery: reserve atomically and fail if any line is short.
  // Already-paid online: reserve best-effort and note any shortfall instead.
  let oversoldNote: string | null = null;
  if (allowOversell) {
    const { unreserved } = await reserveLinesBestEffort(supabase, resolved.items, warehouseId);
    if (unreserved.length > 0) {
      const labels = unreserved
        .map((l) => (l.variantLabel ? `${l.productTitle} (${l.variantLabel})` : l.productTitle))
        .join(", ");
      oversoldNote = `⚠ Paid online but out of stock at fulfillment: ${labels}.`;
    }
  } else {
    const reserveResult = await reserveLines(supabase, resolved.items, warehouseId);
    if (reserveResult.error) {
      return { success: false, error: reserveResult.error };
    }
  }

  const subtotal = roundMoney(
    resolved.items.reduce((sum, it) => sum + it.lineTotal, 0),
  );
  // Same clamp as sales: never negative, never more than the subtotal.
  const discount = clampDiscount(input.discountAmount, subtotal);
  // What the courier collects on delivery — recorded, but NOT added to the
  // total. The customer owes the discounted subtotal either way.
  const codCharge = Math.max(0, input.codCharge ?? 0);
  const total = roundMoney(subtotal - discount);
  const baseNote = input.notes?.trim() || null;
  const notes = [baseNote, oversoldNote].filter(Boolean).join("\n") || null;

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: input.customerName.trim(),
      customer_phone: input.customerPhone.trim(),
      customer_phone2: input.customerPhone2?.trim() || null,
      customer_address: input.customerAddress.trim(),
      notes,
      source,
      channel,
      warehouse_id: warehouseId,
      status: "pending",
      payment_method: payment?.method ?? "cod",
      payment_status: payment?.status ?? "unpaid",
      esewa_transaction_code: payment?.esewaTransactionCode ?? null,
      esewa_transaction_uuid: payment?.esewaTransactionUuid ?? null,
      subtotal,
      discount_amount: discount,
      cod_charge: codCharge,
      total,
    })
    .select("id")
    .single();

  if (orderError || !orderRow) {
    if (!allowOversell) await releaseLines(supabase, resolved.items, warehouseId);
    return { success: false, error: orderError?.message ?? "Could not create order." };
  }

  const orderId = (orderRow as { id: string }).id;
  const { error: itemsError } = await supabase.from("order_items").insert(
    resolved.items.map((it) => ({
      order_id: orderId,
      product_id: it.productId,
      product_variant_id: it.productVariantId,
      combo_id: it.comboId,
      product_title: it.productTitle,
      variant_label: it.variantLabel,
      sku: it.sku,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      line_total: it.lineTotal,
    })),
  );

  if (itemsError) {
    if (!allowOversell) await releaseLines(supabase, resolved.items, warehouseId);
    await supabase.from("orders").delete().eq("id", orderId);
    return { success: false, error: itemsError.message };
  }

  return { success: true, orderId };
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    await requirePermission("orders.create");
    const supabase = createAdminClient();
    // Admin orders choose their channel (a walk-in may order something out of
    // stock for later delivery); default to online, which is the common case.
    return await createOrderCore(supabase, input, {
      source: "admin",
      channel: input.channel ?? "online",
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Public storefront checkout: no auth. Prices recomputed server-side. */
export async function placePublicOrder(
  input: CreateOrderInput,
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    const supabase = createAdminClient();
    // A customer checking out on the public site is online by definition.
    return await createOrderCore(supabase, input, {
      source: "storefront",
      channel: "online",
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Place a storefront order that was already paid online via eSewa. Called from
 * the eSewa success callback after the payment signature has been verified.
 * Tags the order with the payment method/refs and marks it paid. Stock is
 * reserved best-effort so a captured payment is never rejected for stock.
 */
export async function placePaidEsewaOrder(
  input: CreateOrderInput,
  esewa: { transactionCode: string | null; transactionUuid: string },
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    const supabase = createAdminClient();
    return await createOrderCore(supabase, input, {
      source: "storefront",
      channel: "online",
      allowOversell: true,
      payment: {
        method: "esewa",
        status: "paid",
        esewaTransactionCode: esewa.transactionCode,
        esewaTransactionUuid: esewa.transactionUuid,
      },
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requirePermission("orders.edit");
    const supabase = createAdminClient();
    const row = await getOrderById(orderId);
    if (!row) return { success: false, error: "Order not found." };
    // Delivering an order converts it to a sale; attribute that to whoever
    // marked it delivered rather than to the system.
    const result = await applyStatusTransition(supabase, row, status, {}, {
      userId: ctx.userId,
      email: ctx.email,
    });
    return result.error
      ? { success: false, error: result.error }
      : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Change an order's discount after it was created, recomputing the total.
 *
 * Deliberately narrow: orders are otherwise immutable once placed, and this
 * touches neither items nor stock. Blocked once the order is shipped, delivered
 * or cancelled, so the total can never contradict the COD amount already handed
 * to the courier or a sale already converted from it.
 */
export async function updateOrderDiscount(
  orderId: string,
  discountAmount: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("orders.edit");
    const supabase = createAdminClient();

    const row = await getOrderById(orderId);
    if (!row) return { success: false, error: "Order not found." };

    if (row.status !== "pending" && row.status !== "processing") {
      return {
        success: false,
        error: "A discount can only be changed before the order ships.",
      };
    }

    const subtotal = row.subtotal;
    const discount = clampDiscount(discountAmount, subtotal);
    const total = roundMoney(subtotal - discount);

    const { error } = await supabase
      .from("orders")
      .update({
        discount_amount: discount,
        total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function cancelOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("orders.cancel");
    const supabase = createAdminClient();
    const row = await getOrderById(orderId);
    if (!row) return { success: false, error: "Order not found." };
    const result = await applyStatusTransition(supabase, row, "cancelled");
    return result.error
      ? { success: false, error: result.error }
      : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Permanently remove a cancelled order, and its line items with it (the FK
 * cascades).
 *
 * Deliberately narrow, because deletion cannot be undone: an order only
 * qualifies when it holds neither stock nor revenue. `orderDeleteBlocker` owns
 * that rule and explains each case.
 */
export async function deleteOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("orders.delete");
    const supabase = createAdminClient();

    const row = await getOrderById(orderId);
    if (!row) return { success: false, error: "Order not found." };

    // The same predicate the UI uses to decide whether to offer the button, so
    // the two can never disagree about what is deletable.
    const blocker = orderDeleteBlocker(mapOrderRow(row));
    if (blocker) return { success: false, error: blocker };

    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Manually return stock for an order whose items physically came back. Used for
 * orders that were already delivered (stock committed): we never auto-restock.
 */
export async function restockOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("orders.edit");
    const supabase = createAdminClient();
    const row = await getOrderById(orderId);
    if (!row) return { success: false, error: "Order not found." };
    if (!row.stock_committed) {
      return {
        success: false,
        error: "This order's stock was not deducted, so there is nothing to restock.",
      };
    }
    await restockOrderItems(supabase, row);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
