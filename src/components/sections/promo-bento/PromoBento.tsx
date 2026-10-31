import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { cn } from "@/utils/cn";

export interface PromoTile {
  id: string;
  imageUrl: string;
  /** Headline, set in a pill across the top of the poster. */
  title: string;
  href: string;
  /** Short pill along the bottom, e.g. "Now available". */
  ctaLabel: string;
}

interface PromoBentoProps {
  tiles: PromoTile[];
  className?: string;
}

/**
 * How each tile sits in the desktop grid, by position.
 *
 * Three equal portrait tiles across the top, then a narrow and a wide tile
 * beneath. A fourth tile with no fifth to pair with takes the whole second
 * row, so the grid never ends on a gap.
 */
function desktopPlacement(index: number, total: number): string {
  if (index < 3) return "lg:aspect-[4/5]";
  if (total === 4) return "lg:col-span-3 lg:aspect-auto lg:h-[22rem]";
  return index === 3
    ? "lg:aspect-auto lg:h-[22rem]"
    : "lg:col-span-2 lg:aspect-auto lg:h-[22rem]";
}

const pill =
  "rounded-full bg-black/55 px-5 py-2 text-center text-white backdrop-blur-md";

/**
 * The home page's opening: a grid of campaign posters in place of a single
 * hero.
 *
 * A shop has several things worth leading with at once, and a grid shows all
 * of them in the first screen where a carousel shows one and hides the rest
 * behind a timer. Each poster is a photograph with a headline pill across the
 * top and a short call along the bottom, and the whole poster is one link.
 *
 * On a phone the grid becomes a single swipeable row. Five portrait tiles
 * stacked would be four screens before the first product; a row costs one,
 * and the next tile peeking in from the right says there is more.
 */
export function PromoBento({ tiles, className }: PromoBentoProps) {
  if (tiles.length === 0) return null;

  const shown = tiles.slice(0, 5);

  return (
    <section className={cn("pt-6 pb-4 lg:pt-8", className)}>
      <Container>
        {/* `scroll-px-*` matches the padding: without it the snap aligns the
            first tile to the scroller's edge and it sits flush to the screen. */}
        <div className="scrollbar-hidden -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0">
          {shown.map((tile, index) => (
            <Link
              key={tile.id}
              href={tile.href}
              className={cn(
                "group bg-surface focus-visible:ring-ring relative block aspect-[4/5] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-[44%] lg:w-auto",
                desktopPlacement(index, shown.length),
              )}
            >
              {/* Poster photos are local files or arbitrary remote URLs, as
                  everywhere else on the storefront. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.imageUrl}
                alt=""
                // The first tile is the largest thing above the fold.
                fetchPriority={index === 0 ? "high" : "auto"}
                loading={index < 3 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />

              {/* Light vignettes at the two edges the pills sit on, so a pale
                  photo does not swallow them. The middle stays untouched. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent via-30% to-transparent"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent via-30% to-transparent"
              />

              <div className="absolute inset-x-0 top-0 flex justify-center p-5 lg:p-6">
                <h3
                  className={cn(
                    pill,
                    "font-heading max-w-full text-lg leading-tight font-bold text-balance lg:text-2xl",
                  )}
                >
                  {tile.title}
                </h3>
              </div>

              <div className="absolute inset-x-0 bottom-0 flex justify-center p-5 lg:p-6">
                <span
                  className={cn(
                    pill,
                    "inline-flex items-center gap-1.5 text-sm font-semibold transition-colors group-hover:bg-black/75 lg:text-base",
                  )}
                >
                  {tile.ctaLabel}
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
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
