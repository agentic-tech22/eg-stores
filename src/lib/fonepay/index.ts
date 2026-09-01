/**
 * Fonepay Dynamic QR helpers: PRN generation and HMAC-SHA512 signing. Pure
 * functions, safe to import from server code (mirrors `esewa/index.ts`).
 */

import crypto from "crypto";
import { FONEPAY_CONFIG } from "./config";

/** HMAC-SHA512 of `message`, hex-encoded (Fonepay's `dataValidation` scheme). */
function hmacSha512(
  message: string,
  secretKey: string = FONEPAY_CONFIG.secretKey,
): string {
  return crypto.createHmac("sha512", secretKey).update(message).digest("hex");
}

/**
 * A unique payment reference number. Fonepay caps the PRN at 25 chars, so we use
 * a compact base36 timestamp + short random suffix (e.g. `S-lyq1p2z3-a1b2c3`),
 * which comfortably fits and stays collision-safe.
 */
export function generatePrn(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(3).toString("hex");
  return `S-${ts}-${rand}`;
}

/**
 * `dataValidation` for QR generation: HMAC-SHA512 over
 * `amount,prn,merchantCode,remarks1,remarks2` (comma-separated, not URL-encoded).
 */
export function qrDataValidation(params: {
  amount: string;
  prn: string;
  remarks1: string;
  remarks2: string;
}): string {
  const { amount, prn, remarks1, remarks2 } = params;
  const message = `${amount},${prn},${FONEPAY_CONFIG.merchantCode},${remarks1},${remarks2}`;
  return hmacSha512(message);
}

/**
 * `dataValidation` for a status check: HMAC-SHA512 over `prn,merchantCode`.
 */
export function statusDataValidation(prn: string): string {
  return hmacSha512(`${prn},${FONEPAY_CONFIG.merchantCode}`);
}

export { FONEPAY_CONFIG } from "./config";
export type {
  FonepayQrRequest,
  FonepayQrResponse,
  FonepayStatusRequest,
  FonepayStatusResponse,
} from "./config";
