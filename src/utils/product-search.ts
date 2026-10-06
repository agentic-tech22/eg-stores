/**
 * Split what someone typed into the words that all have to match.
 *
 * Returned lowercased and blank-free, so the caller can do this once per search
 * rather than once per product.
 */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Does this text contain every term?
 *
 * Every term, anywhere, in any order — not the whole query as one contiguous
 * run. The shop's titles are written as "casio belt watch 5361", so a shopper
 * typing the two words they actually know, "casio watch", was matched against
 * that literal string, found nothing, and concluded the search was broken.
 *
 * Terms match as substrings rather than whole words, so "earbud" still finds
 * "earbuds" and "charg" finds "charger". Nobody types the plural the shop
 * happened to choose.
 */
export function matchesSearch(text: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * The text a product is searched by.
 *
 * The category name is in here deliberately, and it is the bigger half of the
 * fix. The shop sells 11 speakers and 3 trimmers, but no product title contains
 * the word "speaker" or "trimmer" — those words live only on the category. So
 * searching for the most obvious word for a thing returned nothing at all,
 * while searching a brand name worked fine, which is what made the search look
 * erratic rather than simply limited.
 */
export function productSearchText(
  product: {
    title: string;
    description: string | null;
    sku: string;
  },
  categoryName: string | null,
): string {
  return [product.title, product.description, product.sku, categoryName]
    .filter(Boolean)
    .join(" ");
}
