import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import type { Category } from "@/types/product.types";
import { cn } from "@/utils/cn";

interface CategoryStripProps {
  categories: Category[];
  title?: string;
  eyebrow?: string;
  /**
   * Most tiles to show. This shop runs 25 categories, and pasting all of them
   * onto the home page buries everything below it — the strip is a taster, the
   * full list lives on /products.
   */
  limit?: number;
  className?: string;
}

/**
 * Category tiles linking into the /products grid.
 *
 * A single swipeable row rather than the grid this used to be. A grid of eight
 * boxes is a wall the shopper has to read before reaching any product; a row
 * they can flick through is how every shop app already behaves, and it costs
 * one line of the page instead of four.
 *
 * Renders nothing when the shop has no categories yet — an empty "Shop by
 * category" heading above blank space looks broken, and inventing placeholder
 * categories would send shoppers to empty listings.
 */
export function CategoryStrip({
  categories,
  title = "Shop by category",
  eyebrow = "Browse",
  limit = 10,
  className,
}: CategoryStripProps) {
  if (categories.length === 0) return null;

  const shown = categories.slice(0, limit);
  const hasMore = categories.length > shown.length;

  return (
    <section className={cn("bg-surface py-12 lg:py-16", className)}>
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Typography variant="label" className="text-secondary">
              {eyebrow}
            </Typography>
            <Typography variant="h2" className="text-text-primary">
              {title}
            </Typography>
          </div>

          {hasMore && (
            <Link
              href="/products"
              className="group text-primary hover:text-secondary inline-flex items-center gap-2 text-sm font-bold transition-colors"
            >
              All {categories.length} categories
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          )}
        </div>
      </Container>

      {/* Full-bleed rail: it starts at the container's gutter but runs off the
          right edge, which is what signals there is more to swipe to. */}
      <div className="scrollbar-hidden overflow-x-auto">
        <div className="mx-auto flex w-max gap-3 px-4 sm:px-6 lg:px-8 xl:max-w-7xl">
          {shown.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.id}`}
              className="group border-border/70 bg-background hover:border-primary hover:shadow-primary/10 focus-visible:ring-ring flex shrink-0 items-center gap-3 rounded-full border py-3 pr-5 pl-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary group-hover:bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors group-hover:text-white"
              >
                {category.name.charAt(0).toUpperCase()}
              </span>
              <Typography
                as="span"
                variant="bodySmall"
                className="font-heading text-text-primary group-hover:text-primary font-semibold whitespace-nowrap transition-colors"
              >
                {category.name}
              </Typography>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
