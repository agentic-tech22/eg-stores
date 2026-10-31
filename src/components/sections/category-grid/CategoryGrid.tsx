import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { SectionTitle } from "@/components/molecules/section-title/SectionTitle";
import type { Category } from "@/types/product.types";
import { cn } from "@/utils/cn";

interface CategoryGridProps {
  categories: Category[];
  /**
   * A photo per category id. Categories carry no image of their own, so the
   * page hands in one of each category's products; a category without one
   * gets a lettered tile instead.
   */
  imageByCategory: Map<string, string>;
  title?: string;
  /**
   * Most tiles to show. Twelve is two full rows at desktop width; the full
   * list lives on /products.
   */
  limit?: number;
  className?: string;
}

/**
 * Photo tiles linking into the /products grid, each named over a dark footing
 * along its bottom edge.
 *
 * Categories with a photo are shown first: a row of real products reads as a
 * shop, and a lettered placeholder between two photographs looks like a
 * missing image rather than a design choice.
 *
 * Renders nothing when the shop has no categories yet — an empty heading above
 * blank space looks broken, and invented placeholder categories would send
 * shoppers to empty listings.
 */
export function CategoryGrid({
  categories,
  imageByCategory,
  title = "Browse categories",
  limit = 12,
  className,
}: CategoryGridProps) {
  if (categories.length === 0) return null;

  // Stable within each group, so the shop's own sort order still decides.
  const ordered = [
    ...categories.filter((c) => imageByCategory.has(c.id)),
    ...categories.filter((c) => !imageByCategory.has(c.id)),
  ];
  const shown = ordered.slice(0, limit);
  const hasMore = categories.length > shown.length;

  return (
    <section className={cn("py-14 lg:py-20", className)}>
      <Container>
        <SectionTitle title={title} />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-6">
          {shown.map((category) => {
            const imageUrl = imageByCategory.get(category.id);
            return (
              <Link
                key={category.id}
                href={`/products?category=${category.id}`}
                className="group bg-surface focus-visible:ring-ring relative block aspect-[4/3] overflow-hidden rounded-xl shadow-[0_6px_16px_-8px_rgba(17,24,39,0.35)] transition-shadow duration-300 hover:shadow-[0_14px_28px_-12px_rgba(17,24,39,0.45)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="font-heading text-text-primary/10 absolute inset-0 flex items-center justify-center text-6xl font-extrabold"
                  >
                    {category.name.charAt(0).toUpperCase()}
                  </span>
                )}

                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 via-55% to-transparent"
                />

                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 text-[13px] font-semibold text-white lg:p-4">
                  <span className="truncate">{category.name}</span>
                  <svg
                    className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.2}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>

        {hasMore && (
          <div className="mt-8 flex justify-end">
            <Link
              href="/products"
              className="text-text-primary hover:text-primary text-sm font-semibold underline underline-offset-4 transition-colors"
            >
              {`All ${categories.length} categories »`}
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
