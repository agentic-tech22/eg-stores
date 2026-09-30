import type { PublicProduct } from "@/types/product.types";

/** The orderings offered in the listing's Sort control, in menu order. */
export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Just the fields an ordering looks at, so tests need not build whole products. */
type Sortable = Pick<
  PublicProduct,
  "title" | "price" | "createdAt" | "isFeatured" | "sortOrder"
>;

/**
 * Order a product list.
 *
 * Always sorts a copy: the listing hands in the array it just filtered, and
 * `Array.prototype.sort` mutates in place, so sorting the argument directly
 * would reorder state the caller still holds a reference to.
 */
export function sortProducts<T extends Sortable>(
  products: T[],
  sort: SortValue,
): T[] {
  const sorted = [...products];
  switch (sort) {
    case "newest":
      // ISO 8601 strings, so lexicographic order is chronological order.
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "price-low":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-high":
      return sorted.sort((a, b) => b.price - a.price);
    case "name":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "featured":
    default:
      // The shop's own order: flagged products first, then the sort order the
      // owner dragged them into on the dashboard.
      return sorted.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
  }
}
