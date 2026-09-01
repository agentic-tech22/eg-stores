/**
 * Fonepay Dynamic QR configuration.
 *
 * Ships Fonepay's public UAT/sandbox credentials + endpoints as fallbacks so the
 * integration works out of the box in development (mirrors how `esewa/config.ts`
 * defaults to EPAYTEST). Set the FONEPAY_* env vars to switch to live merchant
 * credentials and the production hosts.
 *
 * API reference (merchant dynamic-QR spec):
 * - Generate QR: POST {base}/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload
 * - Check status: POST {base}/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrGetStatus
 * - UAT base:  https://uat-new-merchant-api.fonepay.com/api
 * - Live base: https://merchantapi.fonepay.com/api
 */

export const FONEPAY_CONFIG = {
  // DEV-ONLY payment simulator. When FONEPAY_SIMULATE=true (and NOT in
  // production), the status poll auto-reports "success" so the full flow can be
  // exercised without a real scan: the public sandbox QR can't actually be paid
  // by live apps ("terminal not found"). Never true in production.
  simulate:
    process.env.FONEPAY_SIMULATE === "true" &&
    process.env.NODE_ENV !== "production",
  merchantCode: process.env.FONEPAY_MERCHANT_CODE || "fonepay123",
  secretKey: process.env.FONEPAY_SECRET_KEY || "fonepay",
  username: process.env.FONEPAY_USERNAME || "bijayk",
  password: process.env.FONEPAY_PASSWORD || "password",
  qrDownloadUrl:
    process.env.FONEPAY_QR_DOWNLOAD_URL ||
    "https://uat-new-merchant-api.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload",
  qrStatusUrl:
    process.env.FONEPAY_QR_STATUS_URL ||
    "https://uat-new-merchant-api.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrGetStatus",
} as const;

/** JSON body POSTed to the QR-download endpoint. */
export interface FonepayQrRequest {
  amount: string;
  remarks1: string;
  remarks2: string;
  prn: string;
  merchantCode: string;
  dataValidation: string;
  username: string;
  password: string;
}

/** Success body returned by the QR-download endpoint. */
export interface FonepayQrResponse {
  message?: string;
  /** The QR data string to render as the scannable QR image. */
  qrMessage?: string;
  status?: string; // "CREATED" on success
  statusCode?: number; // 201 on success
  success?: boolean;
  thirdpartyQrWebSocketUrl?: string;
}

/** JSON body POSTed to the status-check endpoint. */
export interface FonepayStatusRequest {
  prn: string;
  merchantCode: string;
  dataValidation: string;
  username: string;
  password: string;
}

/** Body returned by the status-check endpoint. */
export interface FonepayStatusResponse {
  fonepayTraceId?: number | string;
  merchantCode?: string;
  /** "success" | "failed" | "pending" */
  paymentStatus?: string;
  prn?: string;
}
