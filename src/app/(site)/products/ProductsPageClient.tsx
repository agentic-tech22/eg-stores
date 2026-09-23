"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { ProductCard } from "@/components/molecules/product-card/ProductCard";
import { PageHead } from "@/components/sections/page-head/PageHead";
import {
  ProductFilters,
  isFiltered,
  type ProductFilterState,
} from "@/components/organisms/product-filters/ProductFilters";
import type { Category, PublicProduct } from "@/types/product.types";
import { buildPriceBands } from "@/utils/price-bands";
import {
  matchesSearch,
  productSearchText,
  searchTerms,
} from "@/utils/product-search";
import { cn } from "@/utils/cn";

/** How the grid is ordered. Labels are what the shopper picks from. */
const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** The axes that live in the URL, so a filtered shop can be linked to. */
const QUERY_PARAM = "q";
const CATEGORY_PARAM = "category";

interface ProductsPageClientProps {
  products: PublicProduct[];
  categories?: Category[];
  currency?: { code: string; locale: string };
}

function sortProducts(products: PublicProduct[], sort: SortValue) {
  const sorted = [...products];
  switch (sort) {
    case "newest":
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

export function ProductsPageClient({
  products,
  categories = [],
  currency = { code: "NPR", locale: "en-NP" },
}: ProductsPageClientProps) {
  const searchParams = useSearchParams();

  // Read live from the URL rather than seeding state from it once.
  //
  // This is what made search look broken: `useState(searchParams.get("q"))`
  // only runs on mount, and searching from the header does not remount this
  // page — it changes the query string of the route already on screen. So the
  // URL said one thing, the grid went on showing another, and every search
  // after the first appeared to do nothing.
  const search = searchParams.get(QUERY_PARAM) ?? "";
  const category = searchParams.get(CATEGORY_PARAM) ?? "";

  // Price and availability are deliberately not in the URL: they are a
  // refinement of a listing, not an address for one.
  const [refinement, setRefinement] = useState({
    bandIndex: -1,
    inStockOnly: false,
  });
  const [sort, setSort] = useState<SortValue>("featured");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters: ProductFilterState = { category, ...refinement };

  /**
   * Update the query string in place.
   *
   * `window.history` rather than `router.replace`: this route's server
   * component fetches the entire catalogue, and a router navigation would
   * re-run it just to narrow a list already sitting in the browser. Next
   * wires these native calls into the router, so `useSearchParams` above
   * still sees the change.
   */
  function setParams(next: Partial<Record<string, string>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }

  const bands = useMemo(
    () => buildPriceBands(products.map((p) => p.price)),
    [products],
  );

  // Only offer categories that actually have something in them, and show how
  // many — a category that filters to an empty grid is a dead end.
  const { visibleCategories, countByCategory, categoryNameById } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const product of products) {
      if (product.categoryId) {
        counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1;
      }
    }
    return {
      visibleCategories: categories.filter((c) => (counts[c.id] ?? 0) > 0),
      countByCategory: counts,
      categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
    };
  }, [products, categories]);

  // Not wrapped in useMemo: the React Compiler memoizes this for us, and a
  // manual memo here defeats it — the compiler bails out of optimizing the
  // whole component when it cannot prove a hand-written dependency list
  // matches what it would have derived.
  const filtered = (() => {
    // Tokenised once per search rather than once per product.
    const terms = searchTerms(search.trim());
    const band = refinement.bandIndex >= 0 ? bands[refinement.bandIndex] : null;

    const matched = products.filter((product) => {
      if (terms.length > 0) {
        const text = productSearchText(
          product,
          categoryNameById.get(product.categoryId ?? "") ?? null,
        );
        if (!matchesSearch(text, terms)) return false;
      }
      if (category && product.categoryId !== category) return false;
      if (band) {
        if (product.price < band.min) return false;
        if (band.max !== null && product.price >= band.max) return false;
      }
      if (refinement.inStockOnly) {
        // Variant products and combos hold no meaningful product-level stock,
        // so they are never hidden by this: the detail page is what knows.
        const needsChoice = product.hasVariants || product.isCombo;
        if (!needsChoice && product.available <= 0) return false;
      }
      return true;
    });

    return sortProducts(matched, sort);
  })();

  const narrowed = isFiltered(filters) || search.trim() !== "";

  function handleFiltersChange(next: ProductFilterState) {
    if (next.category !== category) setParams({ [CATEGORY_PARAM]: next.category });
    setRefinement({
      bandIndex: next.bandIndex,
      inStockOnly: next.inStockOnly,
    });
  }

  function clearEverything() {
    setRefinement({ bandIndex: -1, inStockOnly: false });
    setParams({ [QUERY_PARAM]: "", [CATEGORY_PARAM]: "" });
  }

  const filterPanel = (
    <ProductFilters
      categories={visibleCategories}
      countByCategory={countByCategory}
      totalCount={products.length}
      bands={bands}
      currency={currency}
      value={filters}
      onChange={handleFiltersChange}
    />
  );

  return (
    <>
      <PageHead
        eyebrow="The shop"
        title="All products"
        meta={
          <Typography variant="body" className="text-text-secondary">
            {products.length} {products.length === 1 ? "item" : "items"} in
            stock across {visibleCategories.length}{" "}
            {visibleCategories.length === 1 ? "category" : "categories"}
          </Typography>
        }
      />

      {/* ----- Rail + grid ----- */}
      <section className="py-8 lg:py-12">
        <Container>
          <div className="flex gap-8">
            {/* Desktop rail. Sticky so the filters stay reachable however far
                down the grid the shopper has scrolled. */}
            <aside className="hidden w-60 shrink-0 lg:block">
              <div className="bg-shop-ink sidebar-scroll sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl p-5">
                {filterPanel}
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {/* Toolbar. There is no search box here on purpose: the header
                  carries one on every page, at every width, and two search
                  boxes on one screen only raises the question of which is
                  which. The active term shows as a chip instead. */}
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(true)}
                      className="border-border text-text-primary hover:border-primary hover:text-primary inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors lg:hidden"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 6h18M6 12h12M10 18h4"
                        />
                      </svg>
                      Filters
                      {isFiltered(filters) && (
                        <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                      )}
                    </button>

                    <Typography
                      variant="bodySmall"
                      className="text-text-secondary"
                    >
                      Showing {filtered.length} of {products.length}
                      {search.trim() && (
                        <>
                          {" for "}
                          <span className="text-text-primary font-semibold">
                            &ldquo;{search.trim()}&rdquo;
                          </span>
                        </>
                      )}
                    </Typography>
                  </div>

                  <label className="flex items-center gap-2">
                    <span className="text-text-secondary text-xs font-medium">
                      Sort
                    </span>
                    <select
                      value={sort}
                      onChange={(event) =>
                        setSort(event.target.value as SortValue)
                      }
                      className="border-border bg-background text-text-primary focus:border-primary cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus:outline-none"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {filtered.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
                  {filtered.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      currency={currency}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-border/70 flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-20 text-center">
                  <Typography variant="body" className="text-text-secondary">
                    {search.trim()
                      ? `Nothing matches "${search.trim()}".`
                      : "Nothing matches these filters."}
                  </Typography>
                  {narrowed && (
                    <button
                      type="button"
                      onClick={clearEverything}
                      className="bg-primary hover:bg-primary/85 cursor-pointer rounded-full px-6 py-2.5 text-xs font-bold text-white transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* ----- Mobile filter drawer -----
          Kept mounted and slid off-screen so it animates both ways and so the
          filter choices survive closing it. */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={cn(
            "bg-shop-ink border-shop-ink-border absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col border-r shadow-2xl transition-transform duration-300 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="border-shop-ink-border flex items-center justify-between border-b px-5 py-4">
            <span className="text-shop-ink-muted text-[10px] font-bold tracking-[0.2em] uppercase">
              Refine
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close filters"
              className="text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="sidebar-scroll flex-1 overflow-y-auto px-5 py-5">
            {filterPanel}
          </div>

          <div className="border-shop-ink-border border-t px-5 py-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="bg-shop-ink-accent hover:bg-shop-ink-accent/85 w-full cursor-pointer rounded-full px-6 py-3 text-xs font-bold tracking-wide text-white transition-colors"
            >
              Show {filtered.length}{" "}
              {filtered.length === 1 ? "product" : "products"}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
