import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { ProductCard } from "@/components/molecules/product-card/ProductCard";
import type { PublicProduct } from "@/types/product.types";
import { cn } from "@/utils/cn";

interface ProductRailProps {
  products: PublicProduct[];
  title: string;
  eyebrow?: string;
  description?: string;
  /** "See all" link shown beside the heading. Omit to hide it. */
  viewAll?: { label: string; href: string };
  currency?: { code: string; locale: string };
  /** Tint the section to separate it from the block above. */
  surface?: boolean;
  className?: string;
  id?: string;
}

/**
 * A titled grid of products. Used for both "Featured" and "New arrivals" — the
 * only difference between those is the heading and which slice of the catalog
 * the page hands in, so they share one component rather than two near-copies.
 *
 * Renders nothing when there are no products, so a fresh shop with an empty
 * catalog degrades to a shorter page instead of an empty shelf.
 */
export function ProductRail({
  products,
  title,
  eyebrow,
  description,
  viewAll,
  currency,
  surface = false,
  className,
  id,
}: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <section
      id={id}
      className={cn("py-16 lg:py-24", surface && "bg-surface", className)}
    >
      <Container>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            {eyebrow && (
              <Typography variant="label" className="text-secondary">
                {eyebrow}
              </Typography>
            )}
            <Typography variant="h2" className="text-text-primary">
              {title}
            </Typography>
            {description && (
              <Typography
                variant="body"
                className="text-text-secondary max-w-xl"
              >
                {description}
              </Typography>
            )}
          </div>

          {viewAll && (
            <Link
              href={viewAll.href}
              className="group text-primary hover:text-secondary focus-visible:ring-ring inline-flex items-center gap-2 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {viewAll.label}
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
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currency={currency}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
