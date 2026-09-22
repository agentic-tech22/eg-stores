"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { ProductCard } from "@/components/molecules/product-card/ProductCard";
import type { Category, PublicProduct } from "@/types/product.types";
import { cn } from "@/utils/cn";

interface ProductsPageClientProps {
  products: PublicProduct[];
  categories?: Category[];
  currency?: { code: string; locale: string };
}

export function ProductsPageClient({ products, categories = [], currency = { code: "NPR", locale: "en-NP" } }: ProductsPageClientProps) {
  const [search, setSearch] = useState("");
  // "" = all categories; otherwise a category id. Seeded from ?category= so the
  // home page's category tiles land here with that filter already applied.
  const searchParams = useSearchParams();
  const [category, setCategory] = useState(
    () => searchParams.get("category") ?? "",
  );

  // Only offer categories that actually have products in this listing.
  const categoryIdsWithProducts = new Set(
    products.map((p) => p.categoryId).filter((id): id is string => Boolean(id)),
  );
  const visibleCategories = categories.filter((c) => categoryIdsWithProducts.has(c.id));

  // Most expensive first. `filter` already returned a fresh array, so sorting
  // it in place leaves the `products` prop untouched.
  const filtered = products
    .filter((p) => {
      const q = search.toLowerCase();
      const matchesText =
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false);
      const matchesCategory = category === "" || p.categoryId === category;
      return matchesText && matchesCategory;
    })
    .sort((a, b) => b.price - a.price);

  return (
    <>
      <section className="relative overflow-hidden py-16 lg:py-24">
        <div className="pointer-events-none absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <Container className="relative z-10">
          <div className="flex flex-col items-center gap-8 text-center">
            <Typography variant="label" className="inline-block rounded-full bg-secondary/10 px-4 py-1.5 tracking-widest text-secondary">Collection</Typography>
            <Typography variant="h1" className="italic bg-gradient-to-r from-text-primary to-secondary bg-clip-text text-transparent box-decoration-clone px-1">All Products</Typography>
            <Typography variant="bodyLarge" className="text-text-secondary">{products.length} curated items</Typography>
            <div className="w-full max-w-md">
              <div className="flex items-center gap-3 rounded-full border border-border/50 bg-background/60 px-5 py-3 backdrop-blur-sm">
                <svg className="h-4 w-4 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the collection..." className="w-full border-0 bg-transparent text-sm italic text-text-primary placeholder:text-text-secondary/50 focus:ring-0 focus:outline-none" />
                {search && <button type="button" onClick={() => setSearch("")} className="text-text-secondary hover:text-secondary"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24">
        <Container>
          {visibleCategories.length > 0 && (
            <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={cn(
                  "rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
                  category === ""
                    ? "border-secondary bg-secondary text-white"
                    : "border-border/50 text-text-secondary hover:border-secondary/50 hover:text-secondary",
                )}
              >
                All
              </button>
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
                    category === c.id
                      ? "border-secondary bg-secondary text-white"
                      : "border-border/50 text-text-secondary hover:border-secondary/50 hover:text-secondary",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <Typography variant="body" className="italic text-text-secondary">{search ? `Nothing found for "${search}"` : "No products available yet."}</Typography>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
