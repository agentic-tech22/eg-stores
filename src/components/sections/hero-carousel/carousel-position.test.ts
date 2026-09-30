import { describe, expect, it } from "vitest";
import { slideOffset, slidePose, wrapIndex } from "./carousel-position";

describe("slideOffset", () => {
  it("measures the short way around the ring", () => {
    // The bug this prevents: slide 3 of 4 is one step BEFORE slide 0, not
    // three steps after it, so on a wrap it should drift in from the left
    // rather than fly across the whole stage.
    expect(slideOffset(3, 0, 4)).toBe(-1);
    expect(slideOffset(0, 3, 4)).toBe(1);
    expect(slideOffset(4, 0, 5)).toBe(-1);
  });

  it("is zero for the active slide", () => {
    for (let i = 0; i < 5; i += 1) expect(slideOffset(i, i, 5)).toBe(0);
  });

  it("never reports further than half the ring", () => {
    for (const total of [2, 3, 4, 5, 8, 9]) {
      for (let active = 0; active < total; active += 1) {
        for (let index = 0; index < total; index += 1) {
          expect(Math.abs(slideOffset(index, active, total))).toBeLessThanOrEqual(
            total / 2,
          );
        }
      }
    }
  });

  it("copes with an empty ring", () => {
    expect(slideOffset(0, 0, 0)).toBe(0);
  });
});

describe("wrapIndex", () => {
  it("wraps forwards and backwards", () => {
    expect(wrapIndex(3, 1, 4)).toBe(0);
    expect(wrapIndex(0, -1, 4)).toBe(3);
    expect(wrapIndex(0, 0, 4)).toBe(0);
  });

  it("stays in range for any step", () => {
    for (const delta of [-9, -1, 0, 1, 7]) {
      const next = wrapIndex(2, delta, 5);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(5);
    }
  });
});

describe("slidePose", () => {
  it("puts the active slide front and centre, fully opaque", () => {
    expect(slidePose(0)).toEqual({
      translate: 0,
      scale: 1,
      opacity: 1,
      zIndex: 30,
    });
  });

  it("stacks further slides further back, smaller and fainter", () => {
    const ranks = [0, 1, 2, 3].map(slidePose);
    for (let i = 1; i < ranks.length; i += 1) {
      expect(ranks[i].scale).toBeLessThan(ranks[i - 1].scale);
      expect(ranks[i].opacity).toBeLessThan(ranks[i - 1].opacity);
      expect(ranks[i].zIndex).toBeLessThan(ranks[i - 1].zIndex);
      expect(Math.abs(ranks[i].translate)).toBeGreaterThan(
        Math.abs(ranks[i - 1].translate),
      );
    }
  });

  it("mirrors left and right", () => {
    for (const distance of [1, 2, 3]) {
      const left = slidePose(-distance);
      const right = slidePose(distance);
      expect(left.translate).toBe(-right.translate);
      expect(left.scale).toBe(right.scale);
      expect(left.opacity).toBe(right.opacity);
    }
  });

  it("hides anything past the third rank", () => {
    expect(slidePose(3).opacity).toBe(0);
    expect(slidePose(-7).opacity).toBe(0);
  });
});
