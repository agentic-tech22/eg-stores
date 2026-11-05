import { describe, expect, it } from "vitest";
import { GAP, pageWindow } from "./page-window";

describe("pageWindow", () => {
  it("lists every page when they all fit", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("pins the window to the start near the first page", () => {
    expect(pageWindow(1, 44)).toEqual([1, 2, 3, 4, 5, GAP, 44]);
    expect(pageWindow(4, 44)).toEqual([1, 2, 3, 4, 5, GAP, 44]);
  });

  it("centres the window on the current page in the middle", () => {
    expect(pageWindow(5, 44)).toEqual([1, GAP, 4, 5, 6, GAP, 44]);
    expect(pageWindow(20, 44)).toEqual([1, GAP, 19, 20, 21, GAP, 44]);
  });

  it("pins the window to the end near the last page", () => {
    expect(pageWindow(41, 44)).toEqual([1, GAP, 40, 41, 42, 43, 44]);
    expect(pageWindow(44, 44)).toEqual([1, GAP, 40, 41, 42, 43, 44]);
  });

  it("keeps the same number of slots on every page", () => {
    for (let page = 1; page <= 44; page++) {
      expect(pageWindow(page, 44)).toHaveLength(7);
    }
  });

  it("always includes the current page", () => {
    for (let page = 1; page <= 44; page++) {
      expect(pageWindow(page, 44)).toContain(page);
    }
  });

  it("clamps an out-of-range page", () => {
    expect(pageWindow(99, 44)).toEqual(pageWindow(44, 44));
    expect(pageWindow(0, 44)).toEqual(pageWindow(1, 44));
  });
});
