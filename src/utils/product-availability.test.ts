import { describe, expect, it } from "vitest";
import { isBuyable, onlyBuyable } from "./product-availability";

const plain = (available: number) => ({
  hasVariants: false,
  isCombo: false,
  available,
});

describe("isBuyable", () => {
  it("keeps a plain product with stock", () => {
    expect(isBuyable(plain(1))).toBe(true);
    expect(isBuyable(plain(50))).toBe(true);
  });

  it("drops a plain product with none, or an oversold one", () => {
    expect(isBuyable(plain(0))).toBe(false);
    expect(isBuyable(plain(-2))).toBe(false);
  });

  it("keeps variant products whatever the product-level number says", () => {
    // Their stock lives on the variants; the product row reads 0 even when
    // every size is in stock, so testing it here would hide the whole range.
    expect(
      isBuyable({ hasVariants: true, isCombo: false, available: 0 }),
    ).toBe(true);
  });

  it("keeps combos, whose stock is derived from their components", () => {
    expect(
      isBuyable({ hasVariants: false, isCombo: true, available: 0 }),
    ).toBe(true);
  });
});

describe("onlyBuyable", () => {
  it("filters a list, keeping order", () => {
    const list = [plain(3), plain(0), plain(7)];
    expect(onlyBuyable(list)).toEqual([list[0], list[2]]);
  });

  it("returns an empty list unchanged", () => {
    expect(onlyBuyable([])).toEqual([]);
  });
});
