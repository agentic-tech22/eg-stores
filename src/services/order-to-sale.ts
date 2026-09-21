/**
 * Converting a delivered order into a sale.
 *
 * Lives outside any `"use server"` module so it can be called from two places
 * that cannot share one: `sale.service.ts` (the manual "Convert to sale" button,
 * behind a permission check) and `order-engine.ts` (automatically, the moment an
 * order transitions to `delivered` — including from the public NCM webhook,
 * which has no session and so cannot call a permission-gated action).
 *
 * Same split as `createOrder` / `createOrderCore` in `order.service.ts`.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { insertSalePayment } from "@/services/sale-engine";
import { clampDiscount, roundMoney } from "@/lib/pos/sale-payment";
import type { OrderRow } from "@/types/order.types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

/** Who the converted sale is attributed to. */
export interface ConvertActor {
  /** Null when no one was signed in (NCM webhook / background sync). */
  userId: string | null;
  email: string;
}

/**
 * The actor used when delivery arrives with no session — an NCM webhook or a
 * background status sync. `sales.created_by` has no FK and is nullable, so this
 * needs no user record; 'system' simply shows up in the sales list's staff filter.
 */
export const SYSTEM_ACTOR: ConvertActor = { userId: null, email: "system" };

export interface ConvertResult {
  success: boolean;
  error?: string;
  saleId?: string;
  /**
   * True when the order already had a sale. Not an error for the automatic
   * path (delivery can be re-applied), but the manual button reports it.
   */
  alreadyConverted?: boolean;
}

/**
 * Snapshot a DELIVERED order's items into a new sale so its revenue is counted.
 *
 * Delivered orders have already committed (deducted) their stock, so NO stock
 * movement happens here. Idempotent: the UNIQUE constraint on `sales.order_id`
 * plus the guard below mean an order converts at most once.
 *
 * `cod_charge` is excluded — it is what the courier collects, not revenue — but
 * the order's own discount IS carried across, so the sale's total matches what
 * the customer was actually charged.
 *
 * `order` must already carry its `order_items`; every caller loads them
 * (`ORDER_SELECT` embeds them, and the webhook selects them explicitly).
 */
export async function convertOrderToSaleCore(
  supabase: SupabaseClient,
  order: OrderRow,
  actor: ConvertActor,
): Promise<ConvertResult> {
  try {
    if (order.status !== "delivered") {
      return {
        success: false,
        error: "Only delivered orders can be converted to a sale.",
      };
    }

    const { data: existing } = await supabase
      .from("sales")
      .select("id, sale_number")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; sale_number: number };
      return {
        success: false,
        alreadyConverted: true,
        saleId: row.id,
        error: `This order is already converted to sale #${row.sale_number}.`,
      };
    }

    const lines = order.order_items ?? [];
    if (lines.length === 0) {
      return { success: false, error: "This order has no items to convert." };
    }

    // order_items don't carry cost, so snapshot each product's current cost for
    // profit. Cost is product-level (variants inherit it); 0 if the product is gone.
    const productIds = [
      ...new Set(lines.map((l) => l.product_id).filter(Boolean)),
    ] as string[];
    const costByProduct = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", productIds);
      for (const p of (products ?? []) as { id: string; cost_price: number }[]) {
        costByProduct.set(p.id, p.cost_price ?? 0);
      }
    }

    // Revenue date = when the order was delivered (fallback: now). Excludes COD,
    // but keeps the order's discount so the sale matches what was charged.
    const subtotal = order.subtotal;
    const discount = clampDiscount(order.discount_amount, subtotal);
    const total = roundMoney(subtotal - discount);
    const saleDate = (
      order.ncm_delivered_at ??
      order.updated_at ??
      new Date().toISOString()
    ).slice(0, 10);

    const { data: saleRow, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        payment_method: "cash",
        // An order's channel carries onto its sale, so a shop-taken order that
        // gets delivered still reports as a Shop sale.
        channel: order.channel ?? "online",
        warehouse_id: order.warehouse_id,
        subtotal,
        discount_amount: discount,
        total,
        sale_date: saleDate,
        notes: `Converted from order #${order.order_number}`,
        order_id: order.id,
        created_by: actor.userId,
        created_by_email: actor.email,
      })
      .select("id")
      .single();

    if (saleError || !saleRow) {
      // A UNIQUE violation here means a concurrent conversion beat us to it.
      return {
        success: false,
        error: saleError?.message ?? "Could not create sale.",
      };
    }

    // Combos are stored across a priced header line (product_id null) plus
    // zero-priced component lines that bear the stock. Collapse them into the
    // header for the sale: drop the component lines and fold their cost into the
    // combo header's per-unit cost_at_sale so profit stays correct.
    const headerQtyByCombo = new Map<string, number>();
    for (const it of lines) {
      if (it.combo_id && !it.product_id)
        headerQtyByCombo.set(it.combo_id, it.quantity);
    }
    const comboUnitCost = new Map<string, number>();
    for (const it of lines) {
      if (it.combo_id && it.product_id) {
        const headerQty = headerQtyByCombo.get(it.combo_id) || 1;
        const perCombo = it.quantity / headerQty;
        const compCost = costByProduct.get(it.product_id) ?? 0;
        comboUnitCost.set(
          it.combo_id,
          (comboUnitCost.get(it.combo_id) ?? 0) + compCost * perCombo,
        );
      }
    }

    const saleId = (saleRow as { id: string }).id;
    const { error: itemsError } = await supabase.from("sale_items").insert(
      lines
        .filter((it) => !(it.combo_id && it.product_id)) // drop combo components
        .map((it) => ({
          sale_id: saleId,
          product_id: it.product_id,
          product_variant_id: it.product_variant_id,
          product_title: it.product_title,
          variant_label: it.variant_label,
          sku: it.sku,
          quantity: it.quantity,
          unit_price: it.unit_price,
          cost_at_sale: it.combo_id
            ? (comboUnitCost.get(it.combo_id) ?? 0)
            : it.product_id
              ? (costByProduct.get(it.product_id) ?? 0)
              : 0,
          line_total: it.line_total,
        })),
    );

    if (itemsError) {
      await supabase.from("sales").delete().eq("id", saleId);
      return { success: false, error: itemsError.message };
    }

    // A delivered order has already been collected on, so the converted sale
    // opens fully settled. Without a ledger row it would read as entirely due.
    // Note this is the DISCOUNTED total: paying in the subtotal would leave the
    // sale looking overpaid by the discount.
    if (total > 0) {
      await insertSalePayment(
        supabase,
        {
          saleId,
          amount: total,
          paidOn: saleDate,
          paymentMethod: "cash",
          note: `Collected on order #${order.order_number}`,
        },
        actor,
      );
    }

    return { success: true, saleId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
