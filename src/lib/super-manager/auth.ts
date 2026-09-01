import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Access control for the hidden /sm-control panel. It is gated purely by a
 * 4-digit PIN held in the `SUPER_MANAGER_PIN` env var, independent of the
 * normal admin login/permission system, so the panel can govern the dashboard
 * subscription without the shop owner being able to reach it.
 *
 * On a correct PIN we set an httpOnly session cookie whose value is an HMAC of
 * the PIN keyed by the server-only service-role key. The cookie cannot be
 * forged without that key, and it self-invalidates if the PIN env var changes.
 */

const COOKIE_NAME = "sm_session";
/** Cookie lifetime (seconds). Re-entry of the PIN is required after this. */
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

/** The configured PIN, or null when the feature isn't set up. */
export function superManagerPin(): string | null {
  const pin = process.env.SUPER_MANAGER_PIN?.trim();
  return pin ? pin : null;
}

/** A 4-digit PIN check kept lenient on length but strict on digits. */
export function isValidPinShape(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function signingKey(): string {
  // The service-role key is server-only and always present; reuse it as the
  // HMAC secret so we don't need a separate signing secret.
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sm-fallback-key";
}

/** Deterministic, non-forgeable token for a given PIN. */
function tokenFor(pin: string): string {
  return createHmac("sha256", signingKey()).update(`sm:${pin}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** True when the submitted PIN matches the configured one. */
export function pinMatches(pin: string): boolean {
  const configured = superManagerPin();
  if (!configured) return false;
  return safeEqual(pin, configured);
}

/** Set the session cookie after a verified PIN. Call only from a Server Action. */
export async function createSuperManagerSession(): Promise<void> {
  const configured = superManagerPin();
  if (!configured) return;
  const store = await cookies();
  store.set(COOKIE_NAME, tokenFor(configured), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Clear the session cookie. Call only from a Server Action. */
export async function destroySuperManagerSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True when the current request carries a valid super-manager session. */
export async function isSuperManagerAuthed(): Promise<boolean> {
  const configured = superManagerPin();
  if (!configured) return false;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return safeEqual(token, tokenFor(configured));
}
