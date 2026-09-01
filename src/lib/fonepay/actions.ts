"use server";

import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getSaleById } from "@/queries/sale.query";
import {
  insertSalePayment,
  itemsFromRow,
  restoreLines,
  syncSalePaymentStatus,
} from "@/services/sale-engine";
import {
  FONEPAY_CONFIG,
  generatePrn,
  qrDataValidation,
  statusDataValidation,
  type FonepayQrResponse,
  type FonepayStatusResponse,
} from "@/lib/fonepay";

/** Alphanumeric-only, ≤25 chars: Fonepay rejects other characters in remarks. */
function sanitizeRemark(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "POS";
}

interface InitiateResult {
  success: boolean;
  error?: string;
  qrDataUrl?: string;
  prn?: string;
  amount?: number;
}

/**
 * Generate a Fonepay dynamic QR for an already-recorded pending sale. The amount
 * is read from `sales.total` (server-side), never trusted from the client. On
 * success the QR image (a data URL) is returned for the client to display and
 * the sale is stamped with its PRN so status polling can find it.
 */
export async function initiateFonepayQr(
  saleId: string,
): Promise<InitiateResult> {
  try {
    await requirePermission("sales.create");
    const supabase = createAdminClient();

    const { data: sale } = await supabase
      .from("sales")
      .select("id, sale_number, total, payment_method, payment_status, fonepay_prn")
      .eq("id", saleId)
      .single();

    if (!sale) return { success: false, error: "Sale not found." };
    if (sale.payment_method !== "fonepay") {
      return { success: false, error: "This sale is not a Fonepay payment." };
    }
    if (sale.payment_status === "paid") {
      return { success: false, error: "This sale is already paid." };
    }

    const amountNum = Number(sale.total);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return { success: false, error: "Sale amount must be greater than zero." };
    }
    const amount = amountNum.toString();

    // Reuse an existing PRN if the QR was already generated for this sale (e.g.
    // the modal was reopened), so status polling stays consistent.
    const prn = sale.fonepay_prn || generatePrn();
    const remarks1 = sanitizeRemark(`Sale${sale.sale_number}`);
    const remarks2 = "POS";

    const dataValidation = qrDataValidation({ amount, prn, remarks1, remarks2 });

    const res = await fetch(FONEPAY_CONFIG.qrDownloadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        amount,
        remarks1,
        remarks2,
        prn,
        merchantCode: FONEPAY_CONFIG.merchantCode,
        dataValidation,
        username: FONEPAY_CONFIG.username,
        password: FONEPAY_CONFIG.password,
      }),
    });

    let body: FonepayQrResponse;
    try {
      body = (await res.json()) as FonepayQrResponse;
    } catch {
      return { success: false, error: "Fonepay returned an unreadable response." };
    }

    if (!res.ok || !body.qrMessage) {
      return {
        success: false,
        error: body.message || "Fonepay could not generate the QR. Please try again.",
      };
    }

    const qrDataUrl = await QRCode.toDataURL(body.qrMessage, { margin: 1, width: 320 });

    // Persist the PRN so checkFonepaySaleStatus can locate the sale on the callback.
    const { error: updErr } = await supabase
      .from("sales")
      .update({ fonepay_prn: prn, updated_at: new Date().toISOString() })
      .eq("id", saleId);
    if (updErr) {
      return { success: false, error: "Could not save the payment reference." };
    }

    return { success: true, qrDataUrl, prn, amount: amountNum };
  } catch (err) {
    console.error("[Fonepay] initiateFonepayQr failed:", err);
    return { success: false, error: "Could not start the Fonepay payment." };
  }
}

interface StatusResult {
  success: boolean;
  error?: string;
  status?: "pending" | "paid";
}

/**
 * Settle a Fonepay sale once its QR is confirmed paid: stamp the trace id,
 * record the collection in the sale's payment ledger for the full total, and
 * re-derive the settlement state (which also marks any invoice paid).
 *
 * Idempotent by construction: the UPDATE only matches a still-pending sale, so
 * a repeated poll finds no row and writes no second payment. `actor` is the
 * signed-in cashier watching the QR, which is who the collection is booked to.
 */
async function settleFonepaySale(
  supabase: ReturnType<typeof createAdminClient>,
  prn: string,
  traceId: string | null,
  actor: { userId: string; email: string },
): Promise<void> {
  const { data } = await supabase
    .from("sales")
    .update({ fonepay_trace_id: traceId, updated_at: new Date().toISOString() })
    .eq("fonepay_prn", prn)
    .eq("payment_status", "pending")
    .select("id, total, sale_date")
    .maybeSingle();
  if (!data) return;

  const sale = data as { id: string; total: number; sale_date: string };
  await insertSalePayment(
    supabase,
    {
      saleId: sale.id,
      amount: sale.total,
      paidOn: sale.sale_date,
      paymentMethod: "fonepay",
    },
    actor,
  );
  await syncSalePaymentStatus(supabase, sale.id, sale.total);
}

/**
 * Poll Fonepay for the payment status of a sale by its PRN. On a confirmed
 * success, idempotently flips the sale to `paid` and records the trace id.
 *
 * IMPORTANT: Fonepay's getStatus returns paymentStatus="failed" for a PRN that
 * has simply NOT been paid yet: it does not distinguish "not paid yet" from a
 * real failure. So the ONLY status we act on is "success"; anything else
 * (failed/pending/unknown) is treated as "still waiting". Non-payment is handled
 * by the cashier explicitly cancelling, never by an auto "failed" flip.
 */
export async function checkFonepaySaleStatus(prn: string): Promise<StatusResult> {
  try {
    const ctx = await requirePermission("sales.create");
    const actor = { userId: ctx.userId, email: ctx.email };
    if (!prn) return { success: false, error: "Missing payment reference." };

    // Dev-only simulator: the public sandbox QR can't be paid by real apps, so
    // when enabled we treat the payment as successful to exercise the full flow.
    if (FONEPAY_CONFIG.simulate) {
      const supabase = createAdminClient();
      await settleFonepaySale(supabase, prn, null, actor);
      return { success: true, status: "paid" };
    }

    const res = await fetch(FONEPAY_CONFIG.qrStatusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        prn,
        merchantCode: FONEPAY_CONFIG.merchantCode,
        dataValidation: statusDataValidation(prn),
        username: FONEPAY_CONFIG.username,
        password: FONEPAY_CONFIG.password,
      }),
    });

    let body: FonepayStatusResponse;
    try {
      body = (await res.json()) as FonepayStatusResponse;
    } catch {
      return { success: false, error: "Fonepay returned an unreadable response." };
    }

    // Only "success" is actionable; every other value means "not paid yet".
    const status: StatusResult["status"] =
      (body.paymentStatus || "").toLowerCase() === "success" ? "paid" : "pending";

    if (status === "paid") {
      const supabase = createAdminClient();
      await settleFonepaySale(
        supabase,
        prn,
        body.fonepayTraceId ? String(body.fonepayTraceId) : null,
        actor,
      );
    }

    return { success: true, status };
  } catch (err) {
    console.error("[Fonepay] checkFonepaySaleStatus failed:", err);
    return { success: false, error: "Could not check the payment status." };
  }
}

/**
 * Cancel a still-pending Fonepay sale: restore the stock it deducted and delete
 * the sale header (cascading its items). Guarded so only pending, non-converted
 * Fonepay sales can be cancelled this way.
 */
export async function cancelPendingFonepaySale(
  saleId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("sales.create");
    const supabase = createAdminClient();

    const existing = await getSaleById(saleId);
    if (!existing) return { success: false, error: "Sale not found." };
    if (existing.order_id) {
      return { success: false, error: "Converted sales cannot be cancelled here." };
    }
    if (existing.payment_status !== "pending") {
      return { success: false, error: "Only pending payments can be cancelled." };
    }

    await restoreLines(supabase, itemsFromRow(existing), existing.warehouse_id);
    const { error } = await supabase.from("sales").delete().eq("id", saleId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    console.error("[Fonepay] cancelPendingFonepaySale failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not cancel the sale.",
    };
  }
}
