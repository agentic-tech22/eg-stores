/**
 * How far `index` sits from `active`, going the short way around the ring.
 *
 * The carousel is a loop, so the last slide is one step *before* the first, not
 * `total - 1` steps after it. Without that the slide behind you flies the whole
 * width of the stage to get back on screen every time the carousel wraps.
 *
 * Ties on an even-length ring resolve to the positive side, which only decides
 * which way the slide directly opposite the active one is stacked.
 */
export function slideOffset(
  index: number,
  active: number,
  total: number,
): number {
  if (total <= 0) return 0;
  const forward = (((index - active) % total) + total) % total;
  return forward > total / 2 ? forward - total : forward;
}

/** Step `delta` slides from `current`, wrapping in both directions. */
export function wrapIndex(
  current: number,
  delta: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return (((current + delta) % total) + total) % total;
}

/** How an off-centre slide is drawn: further back, smaller and fainter. */
export interface SlidePose {
  /** Percentage of the slide's own width to shift sideways. */
  translate: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/**
 * The pose for a slide at `offset` from centre.
 *
 * Three visible ranks and then nothing. The numbers are tuned so the immediate
 * neighbours bleed off the edges of the stage rather than sitting neatly inside
 * it — the peek is what tells the reader there is more to come, and a slide
 * that fits entirely on screen reads as a grid instead.
 */
export function slidePose(offset: number): SlidePose {
  const distance = Math.abs(offset);
  const direction = Math.sign(offset);

  if (distance === 0) {
    return { translate: 0, scale: 1, opacity: 1, zIndex: 30 };
  }
  if (distance === 1) {
    return {
      translate: direction * 68,
      scale: 0.86,
      opacity: 0.55,
      zIndex: 20,
    };
  }
  if (distance === 2) {
    return {
      translate: direction * 120,
      scale: 0.74,
      opacity: 0.28,
      zIndex: 10,
    };
  }
  // Parked off-stage. Still positioned rather than unmounted, so a wrap
  // animates from the correct side instead of appearing out of nowhere.
  return { translate: direction * 150, scale: 0.7, opacity: 0, zIndex: 0 };
}
