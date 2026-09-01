import { describe, expect, it } from "vitest";
import {
  SALE_SETTLEMENT_INVALIDATIONS,
  SALE_WRITE_INVALIDATIONS,
} from "./invalidation";
import { queryKeys } from "./keys";

/** Flatten to comparable strings; query keys are nested readonly arrays. */
const names = (sets: readonly (readonly unknown[])[]) =>
  sets.map((key) => key.join("."));

describe("sale write invalidation", () => {
  it("invalidates stock caches, not just the sales list", () => {
    // The regression this guards: a sale deducts stock, but only `sales.all`
    // was invalidated, so the products page kept showing pre-sale counts.
    expect(names(SALE_WRITE_INVALIDATIONS)).toEqual(
      expect.arrayContaining([
        queryKeys.sales.all.join("."),
        queryKeys.products.all.join("."),
        queryKeys.warehouses.all.join("."),
      ]),
    );
  });

  it("invalidates at the resource root so list and detail queries both drop", () => {
    // Invalidating `products.list()` alone would leave `products.history(id)`
    // stale; the root prefix covers every query under it.
    for (const key of SALE_WRITE_INVALIDATIONS) {
      expect(key).toHaveLength(1);
    }
  });

  it("has no duplicate entries", () => {
    const flat = names(SALE_WRITE_INVALIDATIONS);
    expect(new Set(flat).size).toBe(flat.length);
  });
});

describe("sale settlement invalidation", () => {
  it("covers the sale and its invoice", () => {
    expect(names(SALE_SETTLEMENT_INVALIDATIONS)).toEqual(
      expect.arrayContaining([
        queryKeys.sales.all.join("."),
        queryKeys.invoices.all.join("."),
      ]),
    );
  });

  it("deliberately leaves inventory alone", () => {
    // Recording a payment moves money, not stock. Invalidating products here
    // would refetch the whole catalog on every payment for nothing.
    expect(names(SALE_SETTLEMENT_INVALIDATIONS)).not.toContain(
      queryKeys.products.all.join("."),
    );
    expect(names(SALE_SETTLEMENT_INVALIDATIONS)).not.toContain(
      queryKeys.warehouses.all.join("."),
    );
  });
});
