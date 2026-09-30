"use client";

import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { ProductCard } from "@/components/molecules/product-card/ProductCard";
import { SearchField } from "@/components/molecules/search-field/SearchField";
import { PageHead } from "@/components/sections/page-head/PageHead";
import {
  ProductFilters,
  emptyFilters,
  isFiltered,
  type ProductFilterState,
} from "@/components/organisms/product-filters/ProductFilters";
import type { Category, PublicProduct } from "@/types/product.types";
import { onlyBuyable } from "@/utils/product-availability";
import { priceRange, withinRange } from "@/utils/price-range";
import {
  SORT_OPTIONS,
  sortProducts,
  type SortValue,
} from "@/utils/product-sort";
import {
  matchesSearch,
  productSearchText,
  searchTerms,
} from "@/utils/product-search";
import { cn } from "@/utils/cn";

/** The axes that live in the URL, so a filtered shop can be linked to. */
const QUERY_PARAM = "q";
const CATEGORY_PARAM = "category";

interface ProductsPageClientProps {
  products: PublicProduct[];
  categories?: Category[];
  currency?: { code: string; locale: string };
}

/** A removable token for one active filter. */
function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="border-border bg-surface text-text-primary inline-flex items-center gap-1.5 rounded-full border py-1.5 pr-1.5 pl-3.5 text-xs font-semibold">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="text-text-secondary hover:bg-border hover:text-text-primary inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function ProductsPageClient({
  products,
  categories = [],
  currency = { code: "NPR", locale: "en-NP" },
}: ProductsPageClientProps) {
  const searchParams = useSearchParams();

  // Read live from the URL rather than seeding state from it once. Seeding
  // only runs on mount, and searching does not remount this page — it changes
  // the query string of the route already on screen, so the URL said one thing
  // and the grid went on showing another.
  const search = searchParams.get(QUERY_PARAM) ?? "";
  const category = searchParams.get(CATEGORY_PARAM) ?? "";

  // Sold-out stock never reaches the grid. A shop that lists what it cannot
  // sell spends the shopper's attention and its own credibility on nothing.
  const sellable = useMemo(() => onlyBuyable(products), [products]);

  const range = useMemo(
    () => priceRange(sellable.map((p) => p.price)),
    [sellable],
  );

  // Price is the only filter held locally: a slider mid-drag has no business
  // rewriting the address bar on every frame.
  const [price, setPrice] = useState<[number, number] | null>(null);
  const [sort, setSort] = useState<SortValue>("featured");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The slider's bounds come from the catalogue, so they change when stock
  // does. Adopting them during render rather than in an effect avoids a pass
  // that shows handles pinned to the previous range.
  const [lastRange, setLastRange] = useState(range);
  if (lastRange !== range) {
    setLastRange(range);
    setPrice(range ? [range.min, range.max] : null);
  }

  const effectivePrice: [number, number] | null =
    price ?? (range ? [range.min, range.max] : null);

  const filters: ProductFilterState = { category, price: effectivePrice };

  /**
   * Update the query string in place.
   *
   * `window.history` rather than `router.replace`: this route's server
   * component fetches the entire catalogue, and a router navigation would
   * re-run it just to narrow a list already sitting in the browser. Next wires
   * these native calls into the router, so `useSearchParams` still sees it.
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

  // Only offer categories that actually have something in them, and show how
  // many — a category that filters to an empty grid is a dead end.
  const { visibleCategories, countByCategory, categoryNameById } =
    useMemo(() => {
      const counts: Record<string, number> = {};
      for (const product of sellable) {
        if (product.categoryId) {
          counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1;
        }
      }
      return {
        visibleCategories: categories.filter((c) => (counts[c.id] ?? 0) > 0),
        countByCategory: counts,
        categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
      };
    }, [sellable, categories]);

  // Not wrapped in useMemo: the React Compiler memoizes this, and a manual memo
  // makes it bail out of optimizing the whole component.
  const filtered = (() => {
    const terms = searchTerms(search.trim());

    const matched = sellable.filter((product) => {
      if (terms.length > 0) {
        const text = productSearchText(
          product,
          categoryNameById.get(product.categoryId ?? "") ?? null,
        );
        if (!matchesSearch(text, terms)) return false;
      }
      if (category && product.categoryId !== category) return false;
      if (effectivePrice && !withinRange(product.price, effectivePrice)) {
        return false;
      }
      return true;
    });

    return sortProducts(matched, sort);
  })();

  const narrowed = isFiltered(filters, range) || search.trim() !== "";
  const activeCategoryName = category
    ? (categoryNameById.get(category) ?? null)
    : null;

  function handleFiltersChange(next: ProductFilterState) {
    if (next.category !== category) {
      setParams({ [CATEGORY_PARAM]: next.category });
    }
    setPrice(next.price);
  }

  function clearEverything() {
    setPrice(emptyFilters(range).price);
    setParams({ [QUERY_PARAM]: "", [CATEGORY_PARAM]: "" });
  }

  const filterPanel = (
    <ProductFilters
      categories={visibleCategories}
      countByCategory={countByCategory}
      totalCount={sellable.length}
      range={range}
      currency={currency}
      value={filters}
      onChange={handleFiltersChange}
    />
  );

  return (
    <>
      {/* Search sits in the page that holds the results, rather than in the
          header on every page of the site. */}
      <PageHead
        eyebrow="The shop"
        title="All products"
        meta={
          <div className="w-full sm:w-80">
            <SearchField tone="light" placeholder="Search the shop..." />
          </div>
        }
      />

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
              {/* Toolbar */}
              <div className="mb-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(true)}
                      className="border-border text-text-primary hover:border-primary hover:text-primary inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors lg:hidden"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {isFiltered(filters, range) && (
                        <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                      )}
                    </button>

                    <Typography
                      variant="bodySmall"
                      className="text-text-secondary"
                    >
                      Showing {filtered.length} of {sellable.length}
                    </Typography>
                  </div>

                  <label className="flex shrink-0 items-center gap-2">
                    <span className="text-text-secondary text-xs font-medium">
                      Sort
                    </span>
                    {/* Native arrow suppressed and replaced with our own, the
                        same way the admin Select does it. Left native, the
                        browser draws its arrow inside the right padding and the
                        longest label runs underneath it. The width is fixed
                        because the labels differ in length: sized to content,
                        picking a different sort shifted the whole toolbar. */}
                    <div className="relative">
                      <select
                        value={sort}
                        onChange={(event) =>
                          setSort(event.target.value as SortValue)
                        }
                        className="border-border bg-background text-text-primary hover:border-primary/50 focus-visible:border-primary focus-visible:ring-primary/20 w-44 cursor-pointer appearance-none rounded-full border py-2 pr-9 pl-4 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {SORT_OPTIONS.map((option) => (
                          // Explicit colours: the popup is drawn by the OS, and
                          // options left to inherit come out dark-on-dark for
                          // anyone running a dark system theme.
                          <option
                            key={option.value}
                            value={option.value}
                            className="bg-background text-text-primary"
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden="true"
                        className="text-text-secondary pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2"
                      />
                    </div>
                  </label>
                </div>

                {/* What is narrowing the grid, and a way out of each. Without
                    this the only record of an active filter is a highlighted
                    row in a rail that is off-screen on a phone. */}
                {narrowed && (
                  <div className="flex flex-wrap items-center gap-2">
                    {search.trim() && (
                      <Chip
                        label={`"${search.trim()}"`}
                        onClear={() => setParams({ [QUERY_PARAM]: "" })}
                      />
                    )}
                    {activeCategoryName && (
                      <Chip
                        label={activeCategoryName}
                        onClear={() => setParams({ [CATEGORY_PARAM]: "" })}
                      />
                    )}
                    <button
                      type="button"
                      onClick={clearEverything}
                      className="text-text-secondary hover:text-primary cursor-pointer text-xs font-semibold underline-offset-4 transition-colors hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
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

      {/* Mobile filter drawer. Kept mounted and slid off-screen so it animates
          both ways and the choices survive closing it. */}
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
              <X className="h-5 w-5" />
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
