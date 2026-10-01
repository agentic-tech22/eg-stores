import { describe, expect, it } from "vitest";
import { isRangeNarrowed, priceRange, withinRange } from "./price-range";

describe("priceRange", () => {
  it("returns nothing when there is no range to show", () => {
    expect(priceRange([])).toBeNull();
    // Everything the same price: two handles pinned together helps nobody.
    expect(priceRange([500, 500, 500])).toBeNull();
  });

  it("contains every product after rounding", () => {
    for (const prices of [
      [900, 1500, 2500, 4800, 19000],
      [149, 7, 88000],
      [1200, 2400, 3900, 7100, 9800],
    ]) {
      const range = priceRange(prices)!;
      expect(Math.min(...prices)).toBeGreaterThanOrEqual(range.min);
      expect(Math.max(...prices)).toBeLessThanOrEqual(range.max);
    }
  });

  it("never starts below zero", () => {
    expect(priceRange([10, 20, 30])!.min).toBeGreaterThanOrEqual(0);
  });

  it("puts both bounds on the step grid", () => {
    for (const prices of [
      [900, 19000],
      [149, 88000],
      [50, 275],
    ]) {
      const { min, max, step } = priceRange(prices)!;
      expect(min % step).toBe(0);
      expect(max % step).toBe(0);
    }
  });

  it("gives enough stops to feel continuous without absurd precision", () => {
    const { min, max, step } = priceRange([900, 19000])!;
    const stops = (max - min) / step;
    expect(stops).toBeGreaterThanOrEqual(10);
    expect(stops).toBeLessThanOrEqual(400);
  });
});

describe("withinRange", () => {
  it("includes both ends", () => {
    expect(withinRange(100, [100, 200])).toBe(true);
    expect(withinRange(200, [100, 200])).toBe(true);
  });

  it("excludes outside", () => {
    expect(withinRange(99, [100, 200])).toBe(false);
    expect(withinRange(201, [100, 200])).toBe(false);
  });
});

describe("isRangeNarrowed", () => {
  const range = { min: 0, max: 1000, step: 10 };

  it("is false at full width", () => {
    expect(isRangeNarrowed([0, 1000], range)).toBe(false);
  });

  it("is true when either handle has moved", () => {
    expect(isRangeNarrowed([10, 1000], range)).toBe(true);
    expect(isRangeNarrowed([0, 990], range)).toBe(true);
    expect(isRangeNarrowed([200, 800], range)).toBe(true);
  });
});
