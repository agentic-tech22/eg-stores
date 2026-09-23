/** The little a spread needs to know about a product. */
interface Categorised {
  id: string;
  categoryId: string | null;
}

/**
 * Take `limit` items from as far apart in the catalogue as possible, at most
 * one per category.
 *
 * The hero showcase used to be the first three featured products, which is fine
 * until a shop flags five watches as featured and the front page becomes a watch
 * shop. One-per-category was the obvious fix and was still not enough: this shop
 * runs "Jens Watch" and "Ladies watch" as two categories sitting next to each
 * other, so the first two picks were a men's watch and a women's watch, and the
 * hero still advertised watches.
 *
 * So rather than the first `limit` categories, this samples the category list at
 * even intervals — first, last, and evenly spaced in between. Neighbouring
 * categories are the ones most likely to hold the same kind of thing, and this
 * is precisely what never picks two of them.
 *
 * That heuristic leans on the ORDER `items` arrives in, which is why choosing
 * the pick of each category is a separate argument rather than something the
 * caller pre-sorts for. Sorting the input to get the better item out of each
 * category also reshuffles the categories, and the two watch categories drift
 * apart and are both sampled again.
 *
 * Uncategorised products each count as their own category rather than sharing
 * one bucket, so a shop that has not categorised anything still gets a spread
 * across its catalogue instead of exactly one item.
 */
export function pickAcrossCategories<T extends Categorised>(
  items: T[],
  limit: number,
  /**
   * Which of two items in the same category to show, sorted first-is-better.
   * Category order is unaffected. Omitted, each category is represented by
   * whichever of its items came first.
   */
  betterFirst?: (a: T, b: T) => number,
): T[] {
  if (limit <= 0) return [];

  // Group by category in first-appearance order, keeping the best item of each.
  const groups = new Map<string, T>();
  for (const item of items) {
    // Null category ids fall back to the product id, which is unique, so each
    // uncategorised product forms a group of its own.
    const key = item.categoryId ?? `uncategorised:${item.id}`;
    const held = groups.get(key);
    if (held === undefined) groups.set(key, item);
    else if (betterFirst && betterFirst(item, held) < 0) groups.set(key, item);
  }
  const leaders = [...groups.values()];

  // Fewer categories than slots: show them all, then top up in the order given
  // so a shop with two categories and three slots still fills all three.
  if (leaders.length <= limit) {
    const picked = [...leaders];
    const pickedIds = new Set(picked.map((item) => item.id));
    for (const item of items) {
      if (picked.length === limit) break;
      if (pickedIds.has(item.id)) continue;
      pickedIds.add(item.id);
      picked.push(item);
    }
    return picked;
  }

  if (limit === 1) return [leaders[0]];

  // Even sampling. `leaders.length > limit >= 2` here, so the indices are
  // strictly increasing and no category is picked twice.
  const picked: T[] = [];
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round((i * (leaders.length - 1)) / (limit - 1));
    picked.push(leaders[index]);
  }
  return picked;
}
