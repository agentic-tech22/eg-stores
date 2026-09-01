import { describe, expect, it } from "vitest";
import {
  stockAtRisk,
  type StockAtRiskProduct,
  type StockAtRiskVariant,
} from "./stock-at-risk";

const simple = (stockQuantity: number): StockAtRiskProduct => ({
  title: "T-Shirt",
  hasVariants: false,
  stockQuantity,
});

const withVariants = (): StockAtRiskProduct => ({
  title: "T-Shirt",
  hasVariants: true,
  stockQuantity: 0,
});

const variant = (
  id: string,
  displayName: string,
  stockQuantity: number,
): StockAtRiskVariant => ({ id, displayName, stockQuantity });

describe("stockAtRisk: nothing to warn about", () => {
  it("stays silent when creating a product", () => {
    expect(
      stockAtRisk({
        product: null,
        existingVariants: [],
        nextHasVariants: false,
        keptVariantIds: [],
      }),
    ).toEqual([]);
  });

  it("stays silent for a simple product that stays simple", () => {
    // Editing the stock field directly is an ordinary audited change.
    expect(
      stockAtRisk({
        product: simple(12),
        existingVariants: [],
        nextHasVariants: false,
        keptVariantIds: [],
      }),
    ).toEqual([]);
  });

  it("stays silent converting a simple product that holds nothing", () => {
    expect(
      stockAtRisk({
        product: simple(0),
        existingVariants: [],
        nextHasVariants: true,
        keptVariantIds: [],
      }),
    ).toEqual([]);
  });

  it("stays silent when every variant is kept", () => {
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [variant("v1", "Red / M", 4), variant("v2", "Red / L", 2)],
        nextHasVariants: true,
        keptVariantIds: ["v1", "v2"],
      }),
    ).toEqual([]);
  });

  it("stays silent when the removed variant holds no stock", () => {
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [variant("v1", "Red / M", 0)],
        nextHasVariants: true,
        keptVariantIds: [],
      }),
    ).toEqual([]);
  });
});

describe("stockAtRisk: simple -> variants", () => {
  it("names the product-level stock being retired", () => {
    expect(
      stockAtRisk({
        product: simple(4),
        existingVariants: [],
        nextHasVariants: true,
        keptVariantIds: [],
      }),
    ).toEqual(['4 on hand against "T-Shirt"']);
  });
});

describe("stockAtRisk: variants -> simple", () => {
  it("names every stocked variant being cleared", () => {
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [
          variant("v1", "Red / M", 3),
          variant("v2", "Red / L", 5),
        ],
        nextHasVariants: false,
        keptVariantIds: [],
      }),
    ).toEqual([
      '3 on hand against "Red / M"',
      '5 on hand against "Red / L"',
    ]);
  });

  it("skips variants already at zero", () => {
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [
          variant("v1", "Red / M", 0),
          variant("v2", "Red / L", 5),
        ],
        nextHasVariants: false,
        keptVariantIds: [],
      }),
    ).toEqual(['5 on hand against "Red / L"']);
  });

  it("ignores keptVariantIds, since converting clears them all", () => {
    // The editor is hidden once variants are turned off, so a stale kept-list
    // must not suppress the warning.
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [variant("v1", "Red / M", 3)],
        nextHasVariants: false,
        keptVariantIds: ["v1"],
      }),
    ).toEqual(['3 on hand against "Red / M"']);
  });
});

describe("stockAtRisk: removing a variant from the editor", () => {
  it("names only the removed variant", () => {
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [
          variant("v1", "Red / M", 3),
          variant("v2", "Red / L", 5),
        ],
        nextHasVariants: true,
        keptVariantIds: ["v1"],
      }),
    ).toEqual(['5 on hand against "Red / L"']);
  });

  it("names several when more than one is removed", () => {
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [
          variant("v1", "Red / M", 3),
          variant("v2", "Red / L", 5),
          variant("v3", "Blue / S", 7),
        ],
        nextHasVariants: true,
        keptVariantIds: ["v2"],
      }),
    ).toEqual([
      '3 on hand against "Red / M"',
      '7 on hand against "Blue / S"',
    ]);
  });

  it("treats a newly added variant (no id yet) as not keeping anything", () => {
    // A brand-new row has `id: undefined`, which the caller filters out. The
    // existing stocked variant is still being dropped and must be reported.
    expect(
      stockAtRisk({
        product: withVariants(),
        existingVariants: [variant("v1", "Red / M", 3)],
        nextHasVariants: true,
        keptVariantIds: [],
      }),
    ).toEqual(['3 on hand against "Red / M"']);
  });
});
