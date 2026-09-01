/**
 * eSewa Payment Gateway configuration.
 *
 * Test credentials (merchant code EPAYTEST, the published test secret, and the
 * RC sandbox gateway) are used as fallbacks so the integration works out of the
 * box in development. Set ESEWA_* env vars to switch to live credentials.
 */

/** Resolve the public base URL used to build callback URLs. */
function resolveBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export const ESEWA_CONFIG = {
  merchantCode: process.env.ESEWA_MERCHANT_CODE || "EPAYTEST",
  secretKey: process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q",
  gatewayUrl:
    process.env.ESEWA_GATEWAY_URL ||
    "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
  statusCheckUrl: "https://rc-epay.esewa.com.np/api/epay/transaction/status/",

  get successUrl() {
    return `${resolveBaseUrl()}/payment/esewa/success`;
  },
  get failureUrl() {
    return `${resolveBaseUrl()}/payment/esewa/failure`;
  },
} as const;

export type EsewaPaymentStatus =
  | "COMPLETE"
  | "PENDING"
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "AMBIGUOUS"
  | "NOT_FOUND"
  | "CANCELED";

/** Decoded `data` payload eSewa returns to the success callback (base64 JSON). */
export interface EsewaSuccessResponse {
  transaction_code: string;
  status: EsewaPaymentStatus;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
}

/** Inputs needed to build a signed payment form. */
export interface EsewaPaymentData {
  amount: number;
  taxAmount?: number;
  productServiceCharge?: number;
  productDeliveryCharge?: number;
  transactionUuid: string;
}

/** Hidden form fields POSTed to the eSewa gateway. */
export interface EsewaFormData {
  amount: string;
  tax_amount: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  product_service_charge: string;
  product_delivery_charge: string;
  success_url: string;
  failure_url: string;
  signed_field_names: string;
  signature: string;
}
