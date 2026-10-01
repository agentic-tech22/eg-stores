import { describe, expect, it } from "vitest";
import {
  COLLAPSE_AT,
  EXPAND_AT,
  HEADER_COLLAPSE_HEIGHT,
  nextCollapsed,
} from "./header-collapse";

describe("nextCollapsed", () => {
  it("does not collapse until the page is clearly scrolled", () => {
    expect(nextCollapsed(false, 0)).toBe(false);
    expect(nextCollapsed(false, COLLAPSE_AT)).toBe(false);
    expect(nextCollapsed(false, COLLAPSE_AT + 1)).toBe(true);
  });

  it("stays collapsed all the way back to the top of the page", () => {
    expect(nextCollapsed(true, COLLAPSE_AT)).toBe(true);
    expect(nextCollapsed(true, EXPAND_AT + 1)).toBe(true);
    expect(nextCollapsed(true, EXPAND_AT)).toBe(false);
    expect(nextCollapsed(true, 0)).toBe(false);
  });

  it("holds its shape right across the dead zone, in both directions", () => {
    // The flicker: scrolling up through here with one threshold flipped the
    // header back and forth.
    for (let y = EXPAND_AT + 1; y <= COLLAPSE_AT; y += 1) {
      expect(nextCollapsed(true, y)).toBe(true);
      expect(nextCollapsed(false, y)).toBe(false);
    }
  });

  it("keeps the dead zone wider than the height the header gives up", () => {
    // Without this the collapse shifts the page far enough to cross the other
    // threshold on its own, and the header oscillates under its own feedback.
    expect(COLLAPSE_AT - EXPAND_AT).toBeGreaterThan(HEADER_COLLAPSE_HEIGHT);
  });

  it("settles instead of oscillating when the collapse moves the page", () => {
    // Model the feedback loop: every shape change moves the scroll position by
    // the height the header gained or lost. A single threshold never settles.
    let collapsed = false;
    let y = 400;
    const seen: boolean[] = [];

    // 400px of page at 4px a step, with room to spare once it reaches the top.
    for (let step = 0; step < 200; step += 1) {
      const next = nextCollapsed(collapsed, y);
      if (next !== collapsed) {
        y += next ? -HEADER_COLLAPSE_HEIGHT : HEADER_COLLAPSE_HEIGHT;
        collapsed = next;
      }
      seen.push(collapsed);
      y -= 4; // the reader keeps scrolling up
      if (y < 0) y = 0;
    }

    // It flips to collapsed once and back to expanded once, and no more.
    const flips = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length;
    expect(flips).toBeLessThanOrEqual(2);
    expect(collapsed).toBe(false);
  });
});
