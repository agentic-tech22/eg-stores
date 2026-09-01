/**
 * Per-device POS warehouse preference.
 *
 * A single terminal typically sells from one physical warehouse, so we remember
 * the choice in a plain (non-httpOnly) cookie: the server component reads it to
 * prefill the sale form, and the client writes it when the cashier picks or
 * changes the terminal's warehouse. It is a device preference, not a security
 * boundary: the actual per-sale warehouse is still validated server-side.
 */
export const POS_WAREHOUSE_COOKIE = "pos_warehouse_id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Reads the device's saved warehouse id from the browser (client-only). */
export function readDeviceWarehouseId(): string | null {
  if (typeof document === "undefined") return null;
  const row = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${POS_WAREHOUSE_COOKIE}=`));
  if (!row) return null;
  const value = decodeURIComponent(row.slice(POS_WAREHOUSE_COOKIE.length + 1));
  return value || null;
}

/** Persists the device's warehouse id for ~a year (client-only). */
export function writeDeviceWarehouseId(warehouseId: string): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${POS_WAREHOUSE_COOKIE}=${encodeURIComponent(warehouseId)}` +
    `; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
