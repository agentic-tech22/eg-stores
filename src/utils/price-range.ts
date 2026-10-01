/** The slider's outer bounds and the granularity it moves in. */
export interface PriceRange {
  min: number;
  max: number;
  step: number;
}

/**
 * Round `value` down/up to something a person would read as a price.
 *
 * The slider's ends are labels, so they should not read "Rs 1,847". Rounding
 * outwards rather than to nearest also guarantees the bounds still contain
 * every product after rounding.
 */
function niceStep(spread: number): number {
  if (spread <= 0) return 1;
  // Aim for roughly a hundred stops across the range: fine enough to feel
  // continuous, coarse enough that the labels stay round.
  const target = spread / 100;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  for (const multiplier of [1, 2, 2.5, 5, 10]) {
    const candidate = multiplier * magnitude;
    if (candidate >= target) return candidate;
  }
  return magnitude * 10;
}

/**
 * The price bounds for a catalogue.
 *
 * Returns null when there is nothing to range over — an empty catalogue, or one
 * where everything costs the same, in which case a slider would be two handles
 * pinned together and worth hiding rather than showing.
 */
export function priceRange(prices: number[]): PriceRange | null {
  const usable = prices.filter((p) => Number.isFinite(p) && p >= 0);
  if (usable.length === 0) return null;

  const lowest = Math.min(...usable);
  const highest = Math.max(...usable);
  if (highest <= lowest) return null;

  const step = niceStep(highest - lowest);
  // Snap outwards so the bounds still include the cheapest and dearest items.
  const min = Math.max(0, Math.floor(lowest / step) * step);
  const max = Math.ceil(highest / step) * step;

  return { min, max, step };
}

/** Is `price` inside the selected range? Bounds are inclusive at both ends. */
export function withinRange(price: number, [low, high]: [number, number]) {
  return price >= low && price <= high;
}

/**
 * Has the shopper actually narrowed anything?
 *
 * Compared against the bounds rather than tracked as a flag, so resetting the
 * slider to its ends counts as "no price filter" without anything extra to
 * keep in sync.
 */
export function isRangeNarrowed(
  value: [number, number],
  range: PriceRange,
): boolean {
  return value[0] > range.min || value[1] < range.max;
}
