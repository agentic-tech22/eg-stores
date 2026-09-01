/**
 * Sale stock engine: pure helpers shared by the sale service. NOT a "use
 * server" module, so these take a Supabase client argument.
 *
 * Stock model: sales deduct stock IMMEDIATELY on creation (no reserve/commit
 * lifecycle like orders). Creating a sale deducts; deleting/editing restores
 * then re-deducts. Each line routes to the variant or product RPC depending on
 * whether it has a `product_variant_id`.
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  firstCustomItemError,
  validateCustomItem,
} from "@/lib/pos/custom-item";
import {
  amountDue,
  paymentStatusFor,
  sumPayments,
} from "@/lib/pos/sale-payment";
import type {
  CustomSaleLine,
  ExtraSaleItem,
  ExtraSaleItemRow,
  PaymentMethod,
  PaymentStatus,
  Sale,
  SaleItem,
  SaleItemRow,
  SalePayment,
  SalePaymentRow,
  SaleRow,
} from "@/types/sale.types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

export function mapSaleItemRow(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productVariantId: row.product_variant_id,
    productTitle: row.product_title,
    variantLabel: row.variant_label,
    sku: row.sku,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    costAtSale: row.cost_at_sale,
    lineTotal: row.line_total,
    createdAt: row.created_at,
  };
}

export function mapExtraSaleItemRow(row: ExtraSaleItemRow): ExtraSaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    title: row.title,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    createdAt: row.created_at,
  };
}

export function mapSalePaymentRow(row: SalePaymentRow): SalePayment {
  return {
    id: row.id,
    saleId: row.sale_id,
    amount: row.amount,
    paidOn: row.paid_on,
    paymentMethod: row.payment_method,
    note: row.note,
    receivedBy: row.received_by ?? null,
    receivedByEmail: row.received_by_email ?? null,
    createdAt: row.created_at,
  };
}

export function mapSaleRow(row: SaleRow): Sale {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerId: row.customer_id ?? null,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status ?? "paid",
    fonepayPrn: row.fonepay_prn ?? null,
    fonepayTraceId: row.fonepay_trace_id ?? null,
    warehouseId: row.warehouse_id,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    total: row.total,
    saleDate: row.sale_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? null,
    createdByEmail: row.created_by_email ?? null,
    items: row.sale_items?.map(mapSaleItemRow),
    extras: row.extra_sale_items?.map(mapExtraSaleItemRow),
    // Newest collection first; the embed's order isn't guaranteed.
    payments: row.sale_payments
      ?.map(mapSalePaymentRow)
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
    orderId: row.order_id ?? null,
    orderNumber: row.order?.order_number ?? null,
  };
}

/**
 * A line resolved against the catalog: validated, priced, ready to persist to
 * `sale_items`. Custom lines never appear here — they resolve to
 * `ResolvedExtraLine` and a different table.
 */
export interface ResolvedLine {
  productId: string;
  productVariantId: string | null;
  productTitle: string;
  variantLabel: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  costAtSale: number;
  lineTotal: number;
}

/**
 * A validated extra-sale line, ready to persist to `extra_sale_items`. It has no
 * product, no SKU and no cost by construction: those are exactly the fields that
 * would let it leak into product reporting.
 */
export interface ResolvedExtraLine {
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LineRequest {
  productId: string;
  productVariantId?: string | null;
  quantity: number;
  /** Set for a custom line: the cashier's own title + unit price. */
  custom?: CustomSaleLine | null;
}

/**
 * Whether a line represents inventory. The priced header line of a converted
 * combo references no product or variant, so there is nothing to deduct or
 * restore for it.
 */
function movesStock(line: {
  productId: string;
  productVariantId: string | null;
}): boolean {
  return Boolean(line.productId || line.productVariantId);
}

/**
 * Validate each requested line against the catalog and compute its price from
 * the variant override or product price. Prices and costs are always taken
 * server-side: client-supplied amounts are ignored.
 *
 * Custom lines are the one exception: there is no catalog row to price against,
 * so the cashier's title and unit price are used as given, after being
 * re-validated here against the same rules the form applies. They come back in
 * a SEPARATE `extras` array, destined for `extra_sale_items` — the split that
 * keeps them out of stock, cost and product reporting.
 */
export async function resolveLines(
  supabase: SupabaseClient,
  lines: LineRequest[],
): Promise<{
  items?: ResolvedLine[];
  extras?: ResolvedExtraLine[];
  error?: string;
}> {
  if (!lines.length) return { error: "Add at least one item." };
  const items: ResolvedLine[] = [];
  const extras: ResolvedExtraLine[] = [];

  for (const line of lines) {
    if (line.custom) {
      const { errors, value } = validateCustomItem({
        title: line.custom.title,
        unitPrice: line.custom.unitPrice,
        quantity: line.quantity,
      });
      if (!value) {
        return { error: firstCustomItemError(errors) ?? "Invalid custom item." };
      }
      extras.push({
        title: value.title,
        quantity: value.quantity,
        unitPrice: value.unitPrice,
        lineTotal: value.unitPrice * value.quantity,
      });
      continue;
    }

    const qty = Math.floor(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: "Quantities must be whole numbers greater than zero." };
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, title, price, cost_price, has_variants, sku")
      .eq("id", line.productId)
      .single();

    if (!product) return { error: "One or more products no longer exist." };
    const p = product as {
      id: string;
      title: string;
      price: number;
      cost_price: number;
      has_variants: boolean;
      sku: string;
    };
    const costAtSale = p.cost_price ?? 0;

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
        productTitle: p.title,
        variantLabel: v.display_name,
        sku: v.sku ?? p.sku,
        quantity: qty,
        unitPrice,
        costAtSale,
        lineTotal: unitPrice * qty,
      });
    } else {
      if (p.has_variants) {
        return { error: `Please choose a variant for "${p.title}".` };
      }
      items.push({
        productId: p.id,
        productVariantId: null,
        productTitle: p.title,
        variantLabel: null,
        sku: p.sku,
        quantity: qty,
        unitPrice: p.price,
        costAtSale,
        lineTotal: p.price * qty,
      });
    }
  }

  return { items, extras };
}

/** Combined value of the catalog and extra lines: the sale's gross subtotal. */
export function subtotalOf(
  items: ResolvedLine[],
  extras: ResolvedExtraLine[],
): number {
  return [...items, ...extras].reduce((sum, it) => sum + it.lineTotal, 0);
}

/**
 * Atomically deduct one line's stock. The DB RPC checks availability
 * (stock - reserved >= qty) and decrements in a single statement, returning
 * FALSE when there isn't enough, so concurrent sales can't both pass a stale
 * check and oversell. Returns whether the deduction succeeded.
 */
async function deductOne(
  supabase: SupabaseClient,
  line: { productId: string; productVariantId: string | null; quantity: number },
  warehouseId: string,
): Promise<boolean> {
  // A line that holds no inventory has nothing to deduct, and never a shortfall.
  if (!movesStock(line)) return true;
  if (line.productVariantId) {
    const { data } = await supabase.rpc("deduct_variant_stock", {
      p_warehouse_id: warehouseId,
      p_variant_id: line.productVariantId,
      p_qty: line.quantity,
    });
    return data === true;
  }
  const { data } = await supabase.rpc("deduct_stock", {
    p_warehouse_id: warehouseId,
    p_product_id: line.productId,
    p_qty: line.quantity,
  });
  return data === true;
}

/** Restore one line's stock (positive delta back into stock_quantity). */
async function restoreOne(
  supabase: SupabaseClient,
  line: { productId: string; productVariantId: string | null; quantity: number },
  warehouseId: string,
): Promise<void> {
  if (movesStock(line)) {
    await supabase.rpc("adjust_warehouse_stock", {
      p_warehouse_id: warehouseId,
      p_product_id: line.productId,
      p_variant_id: line.productVariantId,
      p_delta: line.quantity,
    });
  }
}

/**
 * Deduct every line, guarding against oversell: each line is deducted with an
 * atomic check-and-decrement, and if any line lacks stock the lines already
 * deducted in this call are restored so we never leave a partial deduction.
 */
export async function deductLines(
  supabase: SupabaseClient,
  lines: ResolvedLine[],
  warehouseId: string,
): Promise<{ error?: string }> {
  const deducted: ResolvedLine[] = [];
  for (const line of lines) {
    const ok = await deductOne(supabase, line, warehouseId);
    if (!ok) {
      for (const d of deducted) await restoreOne(supabase, d, warehouseId);
      const label = line.variantLabel
        ? `${line.productTitle} (${line.variantLabel})`
        : line.productTitle;
      return { error: `Insufficient stock for ${label}.` };
    }
    deducted.push(line);
  }
  return {};
}

/** Restore stock for a set of resolved lines (used on delete / before re-deduct). */
export async function restoreLines(
  supabase: SupabaseClient,
  lines: ResolvedLine[],
  warehouseId: string,
): Promise<void> {
  for (const line of lines) await restoreOne(supabase, line, warehouseId);
}

// ── Payment ledger ──────────────────────────────────────────────────────────
// A sale's collected amount is the sum of its `sale_payments` rows, never a
// stored column. These helpers live here (not in the "use server" service) so
// the Fonepay flow can share them without exposing them as server actions.

/** Total collected against a sale so far. */
export async function sumSalePayments(
  supabase: SupabaseClient,
  saleId: string,
): Promise<number> {
  const { data } = await supabase
    .from("sale_payments")
    .select("amount")
    .eq("sale_id", saleId);
  return sumPayments((data ?? []) as { amount: number }[]);
}

/** What is still owed on a sale, from its ledger. */
export async function saleDue(
  supabase: SupabaseClient,
  saleId: string,
  total: number,
): Promise<number> {
  return amountDue(total, await sumSalePayments(supabase, saleId));
}

/** Append one collection, recording who received it and when. */
export async function insertSalePayment(
  supabase: SupabaseClient,
  payment: {
    saleId: string;
    amount: number;
    paidOn: string;
    paymentMethod: PaymentMethod;
    note?: string | null;
  },
  actor: { userId: string; email: string },
): Promise<{ error?: string }> {
  const { error } = await supabase.from("sale_payments").insert({
    sale_id: payment.saleId,
    amount: payment.amount,
    paid_on: payment.paidOn,
    payment_method: payment.paymentMethod,
    note: payment.note?.trim() || null,
    received_by: actor.userId,
    received_by_email: actor.email,
  });
  return error ? { error: error.message } : {};
}

/**
 * Re-derive a sale's settlement state from its ledger and persist it, keeping
 * any generated invoice in step. An invoice only reads 'paid' once the sale is
 * fully settled; a partial collection leaves it issued so it still shows as
 * owed. Cancelled invoices are never touched.
 */
export async function syncSalePaymentStatus(
  supabase: SupabaseClient,
  saleId: string,
  total: number,
): Promise<PaymentStatus> {
  const paid = await sumSalePayments(supabase, saleId);
  const status = paymentStatusFor(total, paid);
  const now = new Date().toISOString();

  await supabase
    .from("sales")
    .update({ payment_status: status, updated_at: now })
    .eq("id", saleId);

  await supabase
    .from("invoices")
    .update({ status: status === "paid" ? "paid" : "issued", updated_at: now })
    .eq("sale_id", saleId)
    .neq("status", "cancelled");

  return status;
}

/** Convert a persisted sale row's items into ResolvedLines for restock. */
export function itemsFromRow(row: SaleRow): ResolvedLine[] {
  return (row.sale_items ?? []).map((it) => ({
    productId: it.product_id ?? "",
    productVariantId: it.product_variant_id,
    productTitle: it.product_title,
    variantLabel: it.variant_label,
    sku: it.sku,
    quantity: it.quantity,
    unitPrice: it.unit_price,
    costAtSale: it.cost_at_sale,
    lineTotal: it.line_total,
  }));
}
