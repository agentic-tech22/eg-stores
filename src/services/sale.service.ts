"use server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  ctxHasPermission,
  getAuthContext,
  requirePermission,
} from "@/lib/auth/session";
import { getOrderById } from "@/queries/order.query";
import { getSaleById, getSales } from "@/queries/sale.query";
import { getDefaultWarehouseId } from "@/queries/warehouse.query";
import {
  deductLines,
  insertSalePayment,
  itemsFromRow,
  mapSaleRow,
  resolveLines,
  restoreLines,
  saleDue,
  subtotalOf,
  sumSalePayments,
  syncSalePaymentStatus,
} from "@/services/sale-engine";
import {
  awardSalePoints,
  reverseSalePoints,
  upsertCustomerByPhone,
} from "@/services/customer-link";
import { convertOrderToSaleCore } from "@/services/order-to-sale";
import {
  clampDiscount,
  CUSTOMER_REQUIRED_MESSAGE,
  hasCustomerIdentity,
  leavesDue,
  paymentStatusFor,
  roundMoney,
  validatePayment,
} from "@/lib/pos/sale-payment";
import {
  PAYMENT_METHODS,
  SALE_CHANNELS,
  type CreateSaleInput,
  type PaymentMethod,
  type PaymentStatus,
  type RecordSalePaymentInput,
  type Sale,
  type SaleChannel,
} from "@/types/sale.types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

/**
 * Strip the per-line cost snapshot unless the caller may see finances, so cost
 * (and therefore profit) never reaches users without the `finances.view` grant.
 * The profit UI is also gated, but this keeps it out of the payload entirely.
 */
function redactSaleCost(sale: Sale, canView: boolean): Sale {
  if (canView || !sale.items) return sale;
  return { ...sale, items: sale.items.map((it) => ({ ...it, costAtSale: 0 })) };
}

async function canViewFinance(): Promise<boolean> {
  return ctxHasPermission(await getAuthContext(), "finances.view");
}

export async function fetchSales(): Promise<Sale[]> {
  await requirePermission("sales.view");
  const rows = await getSales();
  const canView = await canViewFinance();
  return rows.map((r) => redactSaleCost(mapSaleRow(r), canView));
}

export async function fetchSaleById(id: string): Promise<Sale | null> {
  await requirePermission("sales.view");
  const row = await getSaleById(id);
  if (!row) return null;
  return redactSaleCost(mapSaleRow(row), await canViewFinance());
}

function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  return PAYMENT_METHODS.some((m) => m.value === value)
    ? (value as PaymentMethod)
    : null;
}

/**
 * Unlike `normalizePaymentMethod`, an absent channel is not an error: it falls
 * back to 'shop'. A client bundle from before the channel shipped sends no
 * channel at all, and rejecting those would break the counter mid-deploy. An
 * explicitly wrong value is still rejected.
 */
function normalizeSaleChannel(value: unknown): SaleChannel | null {
  if (value === undefined || value === null) return "shop";
  return SALE_CHANNELS.some((c) => c.value === value)
    ? (value as SaleChannel)
    : null;
}

/** Persist the sale header + line items and deduct stock. Lines are assumed
 * already resolved server-side. On any failure after deduction, stock is
 * restored and the partial sale removed. */
async function persistSale(
  supabase: SupabaseClient,
  input: CreateSaleInput,
  actor: { userId: string; email: string },
): Promise<{ success: boolean; error?: string; saleId?: string }> {
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  if (!paymentMethod) {
    return { success: false, error: "Choose a valid payment method." };
  }
  const channel = normalizeSaleChannel(input.channel);
  if (!channel) {
    return { success: false, error: "Choose a valid sales channel." };
  }
  if (!input.saleDate) {
    return { success: false, error: "A sale date is required." };
  }

  const warehouseId = input.warehouseId || (await getDefaultWarehouseId());
  if (!warehouseId) {
    return { success: false, error: "No warehouse is configured." };
  }

  // Catalog lines and extra (non-catalog) lines come back separately: they are
  // persisted to different tables and only the catalog side touches stock.
  const resolved = await resolveLines(supabase, input.items);
  if (resolved.error || !resolved.items || !resolved.extras) {
    return { success: false, error: resolved.error ?? "Invalid items." };
  }
  const extras = resolved.extras;

  const deductResult = await deductLines(supabase, resolved.items, warehouseId);
  if (deductResult.error) {
    return { success: false, error: deductResult.error };
  }

  // The bill covers both sides: the customer pays one total. Splitting product
  // revenue back out is a reporting concern, handled by `saleAmountSplit`.
  const subtotal = subtotalOf(resolved.items, extras);
  const discount = clampDiscount(input.discountAmount, subtotal);
  const total = roundMoney(subtotal - discount);

  // Amount collected at the counter. Omitted means the customer paid in full;
  // Fonepay is settled by its QR callback, never here.
  const isFonepay = paymentMethod === "fonepay";
  const collected = isFonepay
    ? 0
    : Math.min(Math.max(0, roundMoney(input.amountPaid ?? total)), total);

  // A short payment becomes a due, so it has to be traceable to someone. Refuse
  // before any stock is written back or a sale row exists.
  if (!isFonepay && leavesDue(total, collected)) {
    const identified = hasCustomerIdentity({
      name: input.customerName,
      phone: input.customerPhone,
    });
    if (!identified) {
      await restoreLines(supabase, resolved.items, warehouseId);
      return { success: false, error: CUSTOMER_REQUIRED_MESSAGE };
    }
  }

  // Link (or create) a customer when a phone is given, so the sale attaches to
  // the directory. Non-critical: a failure here must never fail the sale.
  let customerId: string | null = null;
  try {
    customerId = await upsertCustomerByPhone(
      supabase,
      { phone: input.customerPhone, name: input.customerName },
      actor,
    );
  } catch (err) {
    console.error("Customer link failed:", err);
  }

  const { data: saleRow, error: saleError } = await supabase
    .from("sales")
    .insert({
      customer_name: input.customerName?.trim() || null,
      customer_phone: input.customerPhone?.trim() || null,
      customer_id: customerId,
      payment_method: paymentMethod,
      channel,
      // Set from what was actually collected at the counter: 'paid' in full,
      // 'partial' when some is still due, 'pending' for a pure credit sale.
      // Fonepay always starts 'pending' and flips on its QR callback.
      payment_status: isFonepay ? "pending" : paymentStatusFor(total, collected),
      warehouse_id: warehouseId,
      subtotal,
      discount_amount: discount,
      total,
      sale_date: input.saleDate,
      notes: input.notes?.trim() || null,
      created_by: actor.userId,
      created_by_email: actor.email,
    })
    .select("id")
    .single();

  if (saleError || !saleRow) {
    await restoreLines(supabase, resolved.items, warehouseId);
    return { success: false, error: saleError?.message ?? "Could not create sale." };
  }

  const saleId = (saleRow as { id: string }).id;
  if (resolved.items.length > 0) {
    const { error: itemsError } = await supabase.from("sale_items").insert(
      resolved.items.map((it) => ({
        sale_id: saleId,
        product_id: it.productId || null,
        product_variant_id: it.productVariantId,
        product_title: it.productTitle,
        variant_label: it.variantLabel,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        cost_at_sale: it.costAtSale,
        line_total: it.lineTotal,
      })),
    );

    if (itemsError) {
      await restoreLines(supabase, resolved.items, warehouseId);
      await supabase.from("sales").delete().eq("id", saleId);
      return { success: false, error: itemsError.message };
    }
  }

  // Extra sales go to their own table. Failing here is treated exactly like a
  // failed line-item insert: the whole sale is rolled back, because a bill
  // missing a charged line would leave the total unexplainable.
  if (extras.length > 0) {
    const { error: extrasError } = await supabase
      .from("extra_sale_items")
      .insert(
        extras.map((it) => ({
          sale_id: saleId,
          title: it.title,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          line_total: it.lineTotal,
        })),
      );

    if (extrasError) {
      await restoreLines(supabase, resolved.items, warehouseId);
      await supabase.from("sales").delete().eq("id", saleId);
      return { success: false, error: extrasError.message };
    }
  }

  // Open the collection ledger with what was taken at the counter, attributed
  // to the cashier who recorded the sale. A pure credit sale (nothing paid) and
  // Fonepay both start with an empty ledger.
  if (collected > 0) {
    const { error: paymentError } = await insertSalePayment(
      supabase,
      {
        saleId,
        amount: collected,
        paidOn: input.saleDate,
        paymentMethod,
      },
      actor,
    );
    if (paymentError) {
      await restoreLines(supabase, resolved.items, warehouseId);
      await supabase.from("sales").delete().eq("id", saleId);
      return { success: false, error: paymentError };
    }
  }

  // Award loyalty points for the completed sale (no-op when loyalty is off or
  // there's no linked customer). Non-critical: never fails the sale.
  if (customerId) {
    try {
      await awardSalePoints(
        supabase,
        { customerId, saleId, total, txnDate: input.saleDate },
        actor,
      );
    } catch (err) {
      console.error("Loyalty award failed:", err);
    }
  }

  return { success: true, saleId };
}

export async function createSale(
  input: CreateSaleInput,
): Promise<{ success: boolean; error?: string; saleId?: string }> {
  try {
    const ctx = await requirePermission("sales.create");
    const supabase = createAdminClient();
    return await persistSale(supabase, input, {
      userId: ctx.userId,
      email: ctx.email,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Replace a sale wholesale: restore the old items' stock, delete the old header
 * (cascading its items), then persist the new sale. Done as restore-then-create
 * so stock and totals always reflect the final state.
 */
export async function updateSale(
  id: string,
  input: CreateSaleInput,
): Promise<{ success: boolean; error?: string; saleId?: string }> {
  try {
    const ctx = await requirePermission("sales.edit");
    const supabase = createAdminClient();

    const existing = await getSaleById(id);
    if (!existing) return { success: false, error: "Sale not found." };

    // Validate the new input before mutating anything irreversible.
    const paymentMethod = normalizePaymentMethod(input.paymentMethod);
    if (!paymentMethod) {
      return { success: false, error: "Choose a valid payment method." };
    }
    const channel = normalizeSaleChannel(input.channel);
    if (!channel) {
      return { success: false, error: "Choose a valid sales channel." };
    }
    const resolved = await resolveLines(supabase, input.items);
    if (resolved.error || !resolved.items || !resolved.extras) {
      return { success: false, error: resolved.error ?? "Invalid items." };
    }
    const extras = resolved.extras;

    // Old stock lives in the warehouse the sale was created against; the new
    // lines deduct from the (possibly changed) input warehouse.
    const oldWarehouseId = existing.warehouse_id;
    const newWarehouseId = input.warehouseId || oldWarehouseId;

    // Converted sales don't own their stock (the source order committed it on
    // delivery), so we never restore/re-deduct for them. Direct sales do.
    const ownsStock = !existing.order_id;

    if (ownsStock) {
      // Restore old stock so deductLines sees true availability.
      await restoreLines(supabase, itemsFromRow(existing), oldWarehouseId);

      const deductResult = await deductLines(supabase, resolved.items, newWarehouseId);
      if (deductResult.error) {
        // Re-deduct the original lines to undo the restore, keeping the old sale intact.
        await deductLines(supabase, itemsFromRow(existing), oldWarehouseId);
        return { success: false, error: deductResult.error };
      }
    }

    const subtotal = subtotalOf(resolved.items, extras);
    const discount = clampDiscount(input.discountAmount, subtotal);
    const total = roundMoney(subtotal - discount);

    // Editing can raise the total past what has already been collected, turning
    // a settled sale into one carrying a due, so the same customer rule
    // applies. Payments themselves are never touched by an edit.
    const alreadyPaid = await sumSalePayments(supabase, id);
    if (
      existing.payment_status !== "failed" &&
      leavesDue(total, alreadyPaid) &&
      !hasCustomerIdentity({
        name: input.customerName,
        phone: input.customerPhone,
      })
    ) {
      if (ownsStock) {
        await restoreLines(supabase, resolved.items, newWarehouseId);
        await deductLines(supabase, itemsFromRow(existing), oldWarehouseId);
      }
      return { success: false, error: CUSTOMER_REQUIRED_MESSAGE };
    }

    // Re-resolve the linked customer from the (possibly changed) phone.
    let customerId: string | null = null;
    try {
      customerId = await upsertCustomerByPhone(
        supabase,
        { phone: input.customerPhone, name: input.customerName },
        { userId: ctx.userId, email: ctx.email },
      );
    } catch (err) {
      console.error("Customer link failed:", err);
    }

    const { error: updateError } = await supabase
      .from("sales")
      .update({
        customer_name: input.customerName?.trim() || null,
        customer_phone: input.customerPhone?.trim() || null,
        customer_id: customerId,
        payment_method: paymentMethod,
        channel,
        warehouse_id: newWarehouseId,
        subtotal,
        discount_amount: discount,
        total,
        sale_date: input.saleDate,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      if (ownsStock) {
        await restoreLines(supabase, resolved.items, newWarehouseId);
        await deductLines(supabase, itemsFromRow(existing), oldWarehouseId);
      }
      return { success: false, error: updateError.message };
    }

    // Replace line items, both kinds.
    await supabase.from("sale_items").delete().eq("sale_id", id);
    await supabase.from("extra_sale_items").delete().eq("sale_id", id);

    if (resolved.items.length > 0) {
      const { error: itemsError } = await supabase.from("sale_items").insert(
        resolved.items.map((it) => ({
          sale_id: id,
          product_id: it.productId || null,
          product_variant_id: it.productVariantId,
          product_title: it.productTitle,
          variant_label: it.variantLabel,
          sku: it.sku,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          cost_at_sale: it.costAtSale,
          line_total: it.lineTotal,
        })),
      );

      if (itemsError) {
        return { success: false, error: itemsError.message };
      }
    }

    if (extras.length > 0) {
      const { error: extrasError } = await supabase
        .from("extra_sale_items")
        .insert(
          extras.map((it) => ({
            sale_id: id,
            title: it.title,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            line_total: it.lineTotal,
          })),
        );

      if (extrasError) {
        return { success: false, error: extrasError.message };
      }
    }

    // Recompute loyalty: drop the old auto-earned row and re-award against the
    // new total/customer. Skipped for converted sales (they don't earn points).
    // Non-critical: never fails the update.
    if (!existing.order_id) {
      try {
        await reverseSalePoints(supabase, id);
        if (customerId) {
          await awardSalePoints(
            supabase,
            { customerId, saleId: id, total, txnDate: input.saleDate },
            { userId: ctx.userId, email: ctx.email },
          );
        }
      } catch (err) {
        console.error("Loyalty re-award failed:", err);
      }
    }

    // The total may have moved either side of what's been collected, so
    // re-derive the settlement state. Two cases keep the status they had: a
    // failed Fonepay sale, and a pending one with an empty ledger, whose QR may
    // still be in flight (or which is a pure credit sale, already correct).
    if (
      existing.payment_status !== "failed" &&
      (alreadyPaid > 0 || existing.payment_status !== "pending")
    ) {
      await syncSalePaymentStatus(supabase, id, total);
    }

    return { success: true, saleId: id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Convert a DELIVERED order into a sale so its revenue is counted — the manual
 * entry point behind the "Convert to sale" button.
 *
 * The work itself lives in `convertOrderToSaleCore`, which is also called
 * automatically the moment an order reaches `delivered`. This wrapper adds the
 * permission check and the signed-in user's attribution; it doubles as the
 * retry path when an automatic conversion failed.
 */
export async function convertOrderToSale(
  orderId: string,
): Promise<{ success: boolean; error?: string; saleId?: string }> {
  try {
    const ctx = await requirePermission("sales.create");
    const supabase = createAdminClient();

    const order = await getOrderById(orderId);
    if (!order) return { success: false, error: "Order not found." };

    const result = await convertOrderToSaleCore(supabase, order, {
      userId: ctx.userId,
      email: ctx.email,
    });
    return {
      success: result.success,
      error: result.error,
      saleId: result.saleId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Record a collection against an outstanding sale balance: the later payment of
 * a due. Writes the amount, the date the money changed hands and the member who
 * received it, then re-derives the sale's (and its invoice's) settlement state.
 *
 * The amount is capped at what is still owed: an overpayment is a refund,
 * which this ledger deliberately doesn't model. Gated by `sales.create`, the
 * same grant that lets a cashier take money at the counter.
 */
export async function recordSalePayment(
  saleId: string,
  input: RecordSalePaymentInput,
): Promise<{ success: boolean; error?: string; status?: PaymentStatus }> {
  try {
    const ctx = await requirePermission("sales.create");
    const supabase = createAdminClient();

    const sale = await getSaleById(saleId);
    if (!sale) return { success: false, error: "Sale not found." };

    const due = await saleDue(supabase, saleId, sale.total);
    const { errors, value } = validatePayment(
      { amount: input.amount, paidOn: input.paidOn },
      due,
    );
    if (!value) {
      return {
        success: false,
        error: errors.amount ?? errors.paidOn ?? "Invalid payment.",
      };
    }

    // Fall back to the sale's own method when the caller doesn't say how the
    // money came in (e.g. the due was settled the same way it was started).
    const method =
      normalizePaymentMethod(input.paymentMethod) ?? sale.payment_method;

    const { error } = await insertSalePayment(
      supabase,
      {
        saleId,
        amount: value.amount,
        paidOn: value.paidOn,
        paymentMethod: method,
        note: input.note,
      },
      { userId: ctx.userId, email: ctx.email },
    );
    if (error) return { success: false, error };

    const status = await syncSalePaymentStatus(supabase, saleId, sale.total);
    return { success: true, status };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Remove a wrongly-entered collection and re-derive the sale's state. The
 * ledger only holds positive amounts, so a correction is a delete rather than
 * an offsetting row. Gated by `sales.edit`, a stricter grant than recording
 * one, since this rewrites settled history.
 */
export async function deleteSalePayment(
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("sales.edit");
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from("sale_payments")
      .select("sale_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment) return { success: false, error: "Payment not found." };

    const saleId = (payment as { sale_id: string }).sale_id;
    const { error } = await supabase
      .from("sale_payments")
      .delete()
      .eq("id", paymentId);
    if (error) return { success: false, error: error.message };

    const sale = await getSaleById(saleId);
    if (sale) await syncSalePaymentStatus(supabase, saleId, sale.total);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Settle a sale in full: record a collection for whatever is still due, then
 * flip the sale (and any invoice) to 'paid'. Used by the Fonepay QR callback
 * once a scan succeeds, and by the "mark as paid" action on a sale. Idempotent
 * An already-settled sale writes nothing. A cancelled invoice is left alone.
 */
export async function markSalePaid(
  saleId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requirePermission("sales.create");
    const supabase = createAdminClient();

    const sale = await getSaleById(saleId);
    if (!sale) return { success: false, error: "Sale not found." };

    const due = await saleDue(supabase, saleId, sale.total);
    if (due > 0) {
      const { error } = await insertSalePayment(
        supabase,
        {
          saleId,
          amount: due,
          paidOn: sale.sale_date,
          paymentMethod: sale.payment_method,
        },
        { userId: ctx.userId, email: ctx.email },
      );
      if (error) return { success: false, error };
    }

    await syncSalePaymentStatus(supabase, saleId, sale.total);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function deleteSale(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("sales.delete");
    const supabase = createAdminClient();

    const existing = await getSaleById(id);
    if (!existing) return { success: false, error: "Sale not found." };

    // Restore the stock that this sale deducted, then delete (cascades items).
    // Converted sales never deducted stock (the order did), so skip the restore
    // for them, otherwise we'd inflate inventory.
    if (!existing.order_id) {
      await restoreLines(supabase, itemsFromRow(existing), existing.warehouse_id);
    }

    // Reverse any auto-earned loyalty points tied to this sale before deleting
    // (the FK is SET NULL, so without this the earn row would orphan). Non-critical.
    try {
      await reverseSalePoints(supabase, id);
    } catch (err) {
      console.error("Loyalty reversal failed:", err);
    }

    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
