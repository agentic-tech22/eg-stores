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
 * Renders nothing when the shop has no categories yet — an empty "Shop by
 * category" heading above blank space looks broken, and inventing placeholder
 * categories would send shoppers to empty listings.
 */
export function CategoryStrip({
  categories,
  title = "Shop by category",
  eyebrow = "Browse",
  limit = 8,
  className,
}: CategoryStripProps) {
  if (categories.length === 0) return null;

  const shown = categories.slice(0, limit);
  const hasMore = categories.length > shown.length;

  return (
    <section className={cn("bg-surface py-16 lg:py-24", className)}>
      <Container>
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Typography variant="label" className="text-secondary">
            {eyebrow}
          </Typography>
          <Typography variant="h2" className="text-text-primary">
            {title}
          </Typography>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.id}`}
              className="group border-border/60 bg-background hover:border-primary/30 hover:shadow-primary/5 focus-visible:ring-ring flex items-center justify-between gap-3 rounded-2xl border px-5 py-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
            >
              <Typography
                as="span"
                variant="body"
                className="font-heading text-text-primary group-hover:text-primary font-semibold transition-colors"
              >
                {category.name}
              </Typography>
              <svg
                className="text-text-secondary group-hover:text-primary h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
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
          ))}
        </div>

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <Link
              href="/products"
              className="group border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:ring-ring inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              See all {categories.length} categories
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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
          </div>
        )}
      </Container>
    </section>
  );
}
