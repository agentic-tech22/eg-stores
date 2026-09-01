"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { resolveLines } from "@/services/order-engine";
import { placePaidEsewaOrder } from "@/services/order.service";
import type { OrderLineInput } from "@/types/order.types";
import {
  ESEWA_CONFIG,
  createPaymentFormData,
  decodeEsewaResponse,
  generateTransactionUuid,
  verifyEsewaSignature,
  type EsewaFormData,
} from "@/lib/esewa";

/** Customer details + cart submitted for an eSewa checkout. */
export interface EsewaCheckoutInput {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string | null;
  customerAddress: string;
  notes?: string | null;
  items: OrderLineInput[];
}

/**
 * Payload we round-trip through the eSewa callback (base64 in the success URL).
 * Holds only what we need to recreate the order: prices are always recomputed
 * server-side on success, never trusted from this blob.
 */
interface EsewaCheckoutPayload {
  customer: {
    name: string;
    phone: string;
    phone2: string | null;
    address: string;
    notes: string | null;
  };
  items: OrderLineInput[];
  total: number;
  transactionUuid: string;
}

interface InitiateResult {
  success: boolean;
  error?: string;
  data?: { gatewayUrl: string; formData: EsewaFormData };
}

/**
 * Begin an eSewa checkout. Validates the cart, prices it server-side, then
 * returns the signed form payload the client auto-submits to eSewa. The order
 * is NOT created here: it is created only after a verified successful payment
 * (see `processEsewaCheckoutSuccess`), so abandoned payments leave no orphan
 * orders or reserved stock.
 */
export async function initiateEsewaCheckout(
  input: EsewaCheckoutInput,
): Promise<InitiateResult> {
  try {
    if (
      !input.customerName?.trim() ||
      !input.customerPhone?.trim() ||
      !input.customerAddress?.trim()
    ) {
      return { success: false, error: "Name, phone, and delivery address are required." };
    }
    if (!input.items?.length) {
      return { success: false, error: "Your cart is empty." };
    }

    const supabase = createAdminClient();
    const resolved = await resolveLines(supabase, input.items);
    if (resolved.error || !resolved.items) {
      return { success: false, error: resolved.error ?? "Invalid items." };
    }

    const total = resolved.items.reduce((sum, it) => sum + it.lineTotal, 0);
    if (total <= 0) {
      return { success: false, error: "Order total must be greater than zero." };
    }

    const transactionUuid = generateTransactionUuid();

    const payload: EsewaCheckoutPayload = {
      customer: {
        name: input.customerName.trim(),
        phone: input.customerPhone.trim(),
        phone2: input.customerPhone2?.trim() || null,
        address: input.customerAddress.trim(),
        notes: input.notes?.trim() || null,
      },
      items: input.items,
      total,
      transactionUuid,
    };

    // eSewa caps the success_url length (~250 chars), so we must NOT round-trip
    // the cart through the redirect URL. Persist it keyed by transaction_uuid and
    // pass only that short reference back in the success_url.
    const { error: pendingError } = await supabase
      .from("pending_esewa_checkouts")
      .insert({ transaction_uuid: transactionUuid, payload, total });
    if (pendingError) {
      console.error("[eSewa] failed to persist pending checkout:", pendingError);
      return { success: false, error: "Could not start the payment. Please try again." };
    }

    const successUrl = `${ESEWA_CONFIG.successUrl}?ref=${transactionUuid}`;
    const failureUrl = ESEWA_CONFIG.failureUrl;

    const formData = createPaymentFormData({
      amount: total,
      transactionUuid,
      successUrl,
      failureUrl,
    });

    return { success: true, data: { gatewayUrl: ESEWA_CONFIG.gatewayUrl, formData } };
  } catch (err) {
    console.error("[eSewa] initiateEsewaCheckout failed:", err);
    return { success: false, error: "Could not start the payment. Please try again." };
  }
}

interface ProcessResult {
  success: boolean;
  error?: string;
  orderId?: string;
}

/**
 * Verify an eSewa success callback and place the paid order.
 * @param encodedEsewaData base64 `data` blob eSewa returns
 * @param ref              our transaction_uuid from the success URL (`?ref=`)
 */
export async function processEsewaCheckoutSuccess(
  encodedEsewaData: string,
  ref: string,
): Promise<ProcessResult> {
  try {
    const esewaResponse = decodeEsewaResponse(encodedEsewaData);
    if (!esewaResponse) {
      return { success: false, error: "Invalid payment response." };
    }
    if (!verifyEsewaSignature(esewaResponse)) {
      return { success: false, error: "Payment verification failed." };
    }
    if (esewaResponse.status !== "COMPLETE") {
      return { success: false, error: `Payment not completed (${esewaResponse.status}).` };
    }

    // The reference in the URL must match the transaction_uuid eSewa signed.
    if (!ref || ref !== esewaResponse.transaction_uuid) {
      return { success: false, error: "Payment reference mismatch." };
    }

    // Recover the cart we stashed at initiation. Look it up by the signed
    // transaction_uuid, never trusting any amount/item data from the redirect.
    const supabase = createAdminClient();
    const { data: pending } = await supabase
      .from("pending_esewa_checkouts")
      .select("payload, total")
      .eq("transaction_uuid", esewaResponse.transaction_uuid)
      .single();

    if (!pending) {
      return { success: false, error: "Your checkout session expired. Please try again." };
    }
    const payload = pending.payload as EsewaCheckoutPayload;

    // The amount eSewa confirmed must match the total we priced at initiation.
    const paidAmount = parseFloat(esewaResponse.total_amount);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(pending.total)) > 0.01) {
      return { success: false, error: "Payment amount mismatch." };
    }

    const result = await placePaidEsewaOrder(
      {
        customerName: payload.customer.name,
        customerPhone: payload.customer.phone,
        customerPhone2: payload.customer.phone2,
        customerAddress: payload.customer.address,
        notes: payload.customer.notes,
        items: payload.items,
      },
      {
        transactionCode: esewaResponse.transaction_code ?? null,
        transactionUuid: esewaResponse.transaction_uuid,
      },
    );

    if (!result.success || !result.orderId) {
      return { success: false, error: result.error ?? "Could not record your order." };
    }

    // Order placed: drop the transient row so a replayed callback can't re-fire.
    await supabase
      .from("pending_esewa_checkouts")
      .delete()
      .eq("transaction_uuid", esewaResponse.transaction_uuid);

    return { success: true, orderId: result.orderId };
  } catch (err) {
    console.error("[eSewa] processEsewaCheckoutSuccess failed:", err);
    return { success: false, error: "Payment processing failed." };
  }
}
