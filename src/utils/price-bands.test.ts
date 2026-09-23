import { describe, expect, it } from "vitest";
import { buildPriceBands } from "./price-bands";

describe("buildPriceBands", () => {
  it("returns nothing when there is too little to divide", () => {
    expect(buildPriceBands([])).toEqual([]);
    expect(buildPriceBands([100, 200, 300])).toEqual([]);
  });

  it("returns nothing when every product costs the same", () => {
    expect(buildPriceBands([500, 500, 500, 500, 500])).toEqual([]);
  });

  it("snaps edges to round numbers without collapsing the band count", () => {
    const bands = buildPriceBands([1200, 2400, 3900, 7100, 9800]);
    // 9800 / 4 = 2450. Rounding that up to 5000 would leave only two bands;
    // 2500 is the round step that actually yields the four asked for.
    expect(bands).toEqual([
      { min: 0, max: 2500 },
      { min: 2500, max: 5000 },
      { min: 5000, max: 7500 },
      { min: 7500, max: null },
    ]);
  });

  it("puts every edge on one step grid, whatever the spread", () => {
    for (const max of [4800, 9800, 13500, 26000, 87000]) {
      const prices = [max * 0.1, max * 0.3, max * 0.55, max * 0.8, max];
      const bands = buildPriceBands(prices);
      const step = bands[0].max as number;
      for (const band of bands) {
        for (const edge of [band.min, band.max ?? 0]) {
          expect(edge % step).toBe(0);
        }
      }
    }
  });

  it("offers more than a single split when the catalogue has room for it", () => {
    // The bug this guards: rounding the ideal step up collapsed a four-band
    // request into "under X" and "X and above", which filters almost nothing.
    expect(buildPriceBands([1200, 2400, 3900, 7100, 9800]).length).toBe(4);
    expect(buildPriceBands([300, 900, 1800, 2600, 3400]).length).toBeGreaterThan(2);
  });

  it("covers the catalogue from zero to open-ended", () => {
    const bands = buildPriceBands([500, 3000, 9000, 15000, 28000, 45000]);
    expect(bands[0].min).toBe(0);
    expect(bands[bands.length - 1].max).toBeNull();
  });

  it("leaves no gaps between consecutive bands", () => {
    const bands = buildPriceBands([900, 4000, 12000, 26000, 51000, 88000]);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i].min).toBe(bands[i - 1].max);
    }
  });

  it("keeps an empty middle band rather than tearing a hole in the ladder", () => {
    // Real catalogue shape: lots of cheap accessories, a few dear watches,
    // nothing in between. Dropping the empty middle band would leave no
    // filter that a hypothetical Rs 12,000 product could ever match.
    const bands = buildPriceBands([
      900, 1500, 2500, 4800, 6200, 9500, 16000, 19000,
    ]);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i].min).toBe(bands[i - 1].max);
    }
    expect(bands[bands.length - 1].max).toBeNull();
  });

  it("drops leading bands no product falls into", () => {
    // Nothing under 40000, so a "0 - 20000" band would filter to an empty grid.
    const bands = buildPriceBands([41000, 46000, 52000, 61000, 78000]);
    expect(bands.every((band) => band.max === null || band.max > 40000)).toBe(
      true,
    );
  });
});
