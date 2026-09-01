/**
 * Which cached resources a write makes stale.
 *
 * Kept out of the hooks so the sets are a plain value a test can assert on. The
 * failure mode they guard against is silent: a mutation that invalidates too
 * little still succeeds, and the bug only shows up as a screen quietly holding
 * pre-write numbers until a hard reload.
 */

import { queryKeys } from "./keys";

/**
 * Stale after a sale is created, edited or deleted.
 *
 * Sales move stock immediately (no reserve/commit step), so the product list
 * and the per-warehouse inventory are as stale as the sales list itself.
 */
export const SALE_WRITE_INVALIDATIONS = [
  queryKeys.sales.all,
  queryKeys.products.all,
  queryKeys.warehouses.all,
];

/**
 * Stale after a settlement write: recording a payment, deleting one, or marking
 * a sale paid. These move money, not stock, so inventory is deliberately absent.
 */
export const SALE_SETTLEMENT_INVALIDATIONS = [
  queryKeys.sales.all,
  queryKeys.invoices.all,
];
