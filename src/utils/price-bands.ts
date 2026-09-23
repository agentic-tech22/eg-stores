/** A price filter preset. `max: null` means "and above". */
export interface PriceBand {
  min: number;
  /** Exclusive upper bound, or null for the open-ended top band. */
  max: number | null;
}

/** Step sizes a person would actually pick, per order of magnitude. */
const STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10];

/**
 * Pick the round step that divides `max` into closest to `bandCount` bands.
 *
 * Rounding the ideal step *up* to the next round number is the obvious approach
 * and it is wrong: an ideal step of 3,000 rounds to 5,000, which turns the four
 * bands that were asked for into two. Scoring the candidates by how many bands
 * they actually produce keeps the rail as fine-grained as was asked for, and
 * still lands on a number the shopper reads as deliberate.
 */
function chooseStep(max: number, bandCount: number): number {
  const target = max / bandCount;
  const magnitude = 10 ** Math.floor(Math.log10(target));

  let best = magnitude;
  let bestScore = Infinity;
  let bestDistance = Infinity;

  for (const multiplier of STEP_MULTIPLIERS) {
    const step = multiplier * magnitude;
    const score = Math.abs(Math.ceil(max / step) - bandCount);
    const distance = Math.abs(step - target);
    // Ties go to the step nearest the ideal, so 2,500 wins over 5,000 when
    // both are one band off.
    if (score < bestScore || (score === bestScore && distance < bestDistance)) {
      best = step;
      bestScore = score;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Build price filter presets from the prices actually in the catalogue.
 *
 * Hardcoded bands are the reason so many shop filters are useless: an "Under
 * Rs 15,000" preset is meaningless in a shop whose dearest item is Rs 4,000,
 * and it would need editing every time the range of stock moves. Deriving them
 * means the presets always straddle the real spread.
 *
 * Returns an empty list when there is nothing to divide — too few products, or
 * a catalogue where everything costs the same — because four bands over one
 * price is just four ways to see the same grid.
 */
export function buildPriceBands(prices: number[], bandCount = 4): PriceBand[] {
  const usable = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (usable.length < bandCount || bandCount < 2) return [];

  const max = Math.max(...usable);
  const min = Math.min(...usable);
  if (max <= min) return [];

  const step = chooseStep(max, bandCount);

  // Edges climb from zero on the step grid. Starting at zero rather than at the
  // cheapest product keeps the first band's label a round number and guarantees
  // nothing falls below the lowest band.
  const bands: PriceBand[] = [];
  for (let i = 1; i < bandCount; i += 1) {
    const edge = step * i;
    // Once an edge passes the dearest product every later band is empty.
    if (edge >= max) break;
    bands.push({ min: step * (i - 1), max: edge });
  }

  if (bands.length === 0) return [];
  bands.push({ min: bands[bands.length - 1].max as number, max: null });

  function hasProducts(band: PriceBand): boolean {
    // Bound into a local: narrowing `band.max` to a number does not follow
    // the callback into `some`.
    const upper = band.max;
    if (upper === null) return true;
    return usable.some((price) => price >= band.min && price < upper);
  }

  // Trim empty bands off the FRONT only. A leading "Under Rs 1,000" in a shop
  // where nothing is under Rs 3,000 is dead weight, but dropping an empty band
  // from the middle would tear a hole in the ladder — a rail reading "Rs 5,000
  // - Rs 10,000" then "Rs 15,000 and above" looks broken, and a product priced
  // Rs 12,000 would be reachable by no price filter at all.
  const firstUsed = bands.findIndex(hasProducts);
  if (firstUsed <= 0) return bands;

  const kept = bands.slice(firstUsed);
  // The new first band absorbs everything below it, so nothing drops out the
  // bottom of the ladder.
  return [{ ...kept[0], min: 0 }, ...kept.slice(1)];
}
