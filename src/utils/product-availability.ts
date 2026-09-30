/** The little that deciding "can this be bought" depends on. */
interface Stockable {
  hasVariants: boolean;
  isCombo: boolean;
  /** Product-level stock, minus what is reserved. */
  available: number;
}

/**
 * Is there anything to sell?
 *
 * Variant products and combos are always treated as buyable, because the
 * product-level number is not their stock: a variant product's stock lives on
 * its variants, and a combo's is whatever its scarcest component can supply.
 * Both read 0 at the product level even when there is plenty on the shelf, so
 * testing `available` there would hide a shop's entire variant range.
 * Their detail pages are what know, and they say so per option.
 */
export function isBuyable(product: Stockable): boolean {
  if (product.hasVariants || product.isCombo) return true;
  return product.available > 0;
}

/** Keep only what can actually be bought. */
export function onlyBuyable<T extends Stockable>(products: T[]): T[] {
  return products.filter(isBuyable);
}
