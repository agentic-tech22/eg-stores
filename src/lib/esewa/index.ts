/**
 * eSewa Payment Gateway helpers: signature generation/verification and form
 * payload building. Pure functions, safe to import from server code.
 */

import crypto from "crypto";
import {
  ESEWA_CONFIG,
  type EsewaFormData,
  type EsewaSuccessResponse,
} from "./config";

/** HMAC-SHA256 of `message`, base64-encoded (eSewa's signature scheme). */
export function generateSignature(
  message: string,
  secretKey: string = ESEWA_CONFIG.secretKey,
): string {
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(message);
  return hmac.digest("base64");
}

/** A unique transaction id: `TXN-<timestamp>-<random>`. */
export function generateTransactionUuid(): string {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString("hex");
  return `TXN-${timestamp}-${randomStr}`;
}

/** Build the signed eSewa form payload with explicit success/failure URLs. */
export function createPaymentFormData(params: {
  amount: number;
  taxAmount?: number;
  productServiceCharge?: number;
  productDeliveryCharge?: number;
  transactionUuid: string;
  successUrl: string;
  failureUrl: string;
}): EsewaFormData {
  const {
    amount,
    taxAmount = 0,
    productServiceCharge = 0,
    productDeliveryCharge = 0,
    transactionUuid,
    successUrl,
    failureUrl,
  } = params;

  const totalAmount = amount + taxAmount + productServiceCharge + productDeliveryCharge;

  // The fields eSewa requires to be signed, in this exact order.
  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_CONFIG.merchantCode}`;
  const signature = generateSignature(message);

  return {
    amount: amount.toString(),
    tax_amount: taxAmount.toString(),
    total_amount: totalAmount.toString(),
    transaction_uuid: transactionUuid,
    product_code: ESEWA_CONFIG.merchantCode,
    product_service_charge: productServiceCharge.toString(),
    product_delivery_charge: productDeliveryCharge.toString(),
    success_url: successUrl,
    failure_url: failureUrl,
    signed_field_names: signedFieldNames,
    signature,
  };
}

/** Decode the base64 JSON `data` param eSewa appends to the success URL. */
export function decodeEsewaResponse(
  encodedData: string,
): EsewaSuccessResponse | null {
  try {
    const decoded = Buffer.from(encodedData, "base64").toString("utf-8");
    return JSON.parse(decoded) as EsewaSuccessResponse;
  } catch {
    return null;
  }
}

/** Verify the response signature using the fields eSewa says it signed. */
export function verifyEsewaSignature(response: EsewaSuccessResponse): boolean {
  try {
    const { signed_field_names, signature } = response;
    const message = signed_field_names
      .split(",")
      .map((field) => {
        const key = field.trim();
        return `${key}=${response[key as keyof EsewaSuccessResponse]}`;
      })
      .join(",");
    return signature === generateSignature(message);
  } catch {
    return false;
  }
}

export { ESEWA_CONFIG } from "./config";
export type {
  EsewaFormData,
  EsewaPaymentData,
  EsewaPaymentStatus,
  EsewaSuccessResponse,
} from "./config";
