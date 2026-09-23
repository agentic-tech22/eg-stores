import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

/** A product tile floated over the cover. Purely decorative, but real stock. */
export interface HeroShowcaseItem {
  id: string;
  title: string;
  imageUrl: string | null;
  href: string;
}

interface HeroProps {
  /** The tagline, set small above the headline. */
  eyebrow?: string;
  title: string;
  /** Second half of the headline, tinted. */
  titleAccent?: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Short trust points shown under the buttons. Hidden when empty. */
  highlights?: string[];
  /**
   * The cover photograph. A real photo of the shop or a campaign image belongs
   * here; see `STORE_HERO` in config/store for where to set it.
   *
   * When it is null the hero falls back to the shop's own product photography,
   * blurred back into a backdrop, and failing that to the ink gradient. The
   * fallbacks exist so a shop that has not supplied a cover still gets a hero
   * built out of its real goods rather than a stock photo of someone else's.
   */
  coverImage?: string | null;
  /** Real products, floated over the cover on large screens. */
  showcase?: HeroShowcaseItem[];
  className?: string;
}

function CheckIcon() {
  return (
    <svg
      className="text-shop-ink-accent h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.4}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function Hero({
  eyebrow,
  title,
  titleAccent,
  description,
  primaryCta,
  secondaryCta,
  highlights = [],
  coverImage = null,
  showcase = [],
  className,
}: HeroProps) {
  const withImages = showcase.filter((item) => item.imageUrl);
  const featured = withImages.slice(0, 3);

  // A supplied cover is shown sharp and alone. Without one, the backdrop is
  // every showcase photo side by side and blurred past recognition, which
  // reads as a wash of the shop colours. Blowing up a single product instead
  // put one enormous out-of-focus wristwatch behind the headline and made the
  // whole page look like a watch shop.
  const covers = coverImage
    ? [coverImage]
    : featured.map((item) => item.imageUrl as string);
  const isMontage = !coverImage && covers.length > 0;

  return (
    <section
      className={cn(
        "bg-shop-ink relative isolate overflow-hidden",
        className,
      )}
    >
      {/* ----- Cover ----- */}
      {covers.length > 0 ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10 flex">
          {covers.map((src) => (
            /* Product images are arbitrary remote URLs, handled as raw <img>
               across the storefront. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              /* The cover is the largest thing above the fold, so it is what
                 the browser measures LCP against. Left to its own devices it
                 queues this behind the stylesheet and the fonts. */
              fetchPriority="high"
              className={cn(
                "motion-safe:animate-ken-burns h-full min-w-0 flex-1 object-cover",
                isMontage ? "scale-125 blur-3xl" : "scale-105",
              )}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_20%_-10%,rgba(139,123,255,0.28),transparent_65%),radial-gradient(48rem_34rem_at_100%_10%,rgba(6,182,212,0.18),transparent_60%)]"
        />
      )}

      {/* Ink wash over the cover. Two layers: a flat tint that guarantees the
          floor, and a left-weighted gradient so the headline side stays darkest
          whatever the photograph happens to be doing there. */}
      <div
        aria-hidden="true"
        className="bg-shop-ink/75 absolute inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="from-shop-ink via-shop-ink/85 absolute inset-0 -z-10 bg-linear-to-r to-transparent"
      />

      <Container className="relative">
        <div className="grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:py-20">
          {/* ----- Copy ----- */}
          <div className="flex max-w-xl flex-col items-start gap-5">
            {eyebrow && (
              <Typography
                variant="label"
                className="border-shop-ink-border bg-shop-ink-raised/70 text-shop-ink-text motion-safe:animate-rise rounded-full border px-4 py-1.5 backdrop-blur-sm"
              >
                {eyebrow}
              </Typography>
            )}

            {/* `h1` rather than `display`: at display size this headline ran to
                72px on a desktop and shouted over the products it is meant to
                be introducing. A shop hero sells the stock, not the slogan. */}
            <Typography
              variant="h1"
              className="text-shop-ink-text-active motion-safe:animate-rise text-balance [animation-delay:80ms]"
            >
              {title}
              {titleAccent && (
                <>
                  {" "}
                  <span className="text-shop-ink-accent">{titleAccent}</span>
                </>
              )}
            </Typography>

            <Typography
              variant="body"
              className="text-shop-ink-text motion-safe:animate-rise max-w-lg text-pretty [animation-delay:160ms]"
            >
              {description}
            </Typography>

            <div className="motion-safe:animate-rise flex flex-col gap-3 pt-1 [animation-delay:240ms] sm:flex-row sm:items-center">
              <Link
                href={primaryCta.href}
                className="bg-shop-ink-accent hover:bg-shop-ink-accent/85 focus-visible:ring-shop-ink-accent focus-visible:ring-offset-shop-ink inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-bold tracking-wide text-white shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0"
              >
                {primaryCta.label}
              </Link>
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  className="border-shop-ink-border text-shop-ink-text-active hover:border-shop-ink-accent/60 hover:bg-shop-ink-hover focus-visible:ring-shop-ink-accent focus-visible:ring-offset-shop-ink inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-bold tracking-wide backdrop-blur-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>

            {highlights.length > 0 && (
              <ul className="motion-safe:animate-rise border-shop-ink-border/70 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6 [animation-delay:320ms]">
                {highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckIcon />
                    <Typography
                      as="span"
                      variant="bodySmall"
                      className="text-shop-ink-text font-medium"
                    >
                      {item}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ----- Product showcase -----
              Hidden below `lg`: on a phone this would push the CTAs under the
              fold to show three thumbnails the shopper is about to scroll past
              anyway. */}
          {featured.length > 0 && (
            <div
              className="hidden w-[22rem] shrink-0 lg:block"
              aria-hidden="true"
            >
              <div className="motion-safe:animate-float relative">
                <Link
                  href={featured[0].href}
                  className="border-shop-ink-border bg-shop-ink-raised group block overflow-hidden rounded-3xl border shadow-2xl shadow-black/50 transition-transform duration-500 hover:-translate-y-1"
                  tabIndex={-1}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured[0].imageUrl ?? ""}
                    alt=""
                    className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="px-5 py-4">
                    <p className="text-shop-ink-muted text-[10px] font-bold tracking-[0.2em] uppercase">
                      In stock now
                    </p>
                    <p className="font-heading text-shop-ink-text-active mt-1 line-clamp-1 text-sm font-semibold">
                      {featured[0].title}
                    </p>
                  </div>
                </Link>

                {featured.length > 1 && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {featured.slice(1, 3).map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        tabIndex={-1}
                        className="border-shop-ink-border bg-shop-ink-raised group block overflow-hidden rounded-2xl border shadow-xl shadow-black/40 transition-transform duration-500 hover:-translate-y-1"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl ?? ""}
                          alt=""
                          className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
