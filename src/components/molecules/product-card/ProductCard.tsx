"use client";

import Link from "next/link";
import { BadgePill } from "@/components/atoms/badge-pill/BadgePill";
import { Price } from "@/components/atoms/price/Price";
import { Typography } from "@/components/atoms/typography";
import { useCart } from "@/components/cart/cart-context";
import { notify } from "@/lib/toast";
import type { PublicProduct } from "@/types/product.types";
import { cn } from "@/utils/cn";

/** At or below this many units we nudge the shopper with a scarcity badge. */
const LOW_STOCK_THRESHOLD = 3;

interface ProductCardProps {
  product: PublicProduct;
  currency?: { code: string; locale: string };
  /**
   * Render the add-to-cart control. Turn it off where the card is purely a
   * navigation tile and the buy decision belongs on the detail page.
   */
  showAddToCart?: boolean;
  className?: string;
}

function ImagePlaceholder() {
  return (
    <div className="bg-surface text-text-secondary/30 flex h-full w-full items-center justify-center">
      <svg
        className="h-12 w-12"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={0.6}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
        />
      </svg>
    </div>
  );
}

/**
 * The one product tile for the whole public site — home page rails and the
 * /products grid both render this, so a change to how a product presents itself
 * happens in exactly one place.
 *
 * Sized to sit two-up on a phone rather than one-up. A single full-width card
 * per row turns a 40-item catalogue into a very long scroll and makes browsing
 * feel like reading; two-up is what every shop people already use does, and it
 * lets them compare two things without scrolling between them.
 *
 * Products that need a choice before they can be bought (variants, combos) link
 * through to their detail page instead of adding straight to the cart: picking a
 * colour or checking what is inside a bundle is not a decision a tile can make.
 */
export function ProductCard({
  product,
  currency = { code: "NPR", locale: "en-NP" },
  showAddToCart = true,
  className,
}: ProductCardProps) {
  const { addItem } = useCart();

  const href = `/products/${product.id}`;
  // Variant products track stock per variant, so the product-level number is
  // not meaningful until one is chosen on the detail page.
  const needsChoice = product.hasVariants || product.isCombo;
  const available = needsChoice ? null : product.available;
  const soldOut = available !== null && available <= 0;
  const lowStock =
    available !== null && available > 0 && available <= LOW_STOCK_THRESHOLD;

  function handleAdd() {
    addItem({
      productId: product.id,
      productVariantId: null,
      title: product.title,
      variantLabel: null,
      unitPrice: product.price,
      imageUrl: product.imageUrl,
      available: product.available,
    });
    notify.success(`${product.title} added to cart`);
  }

  return (
    <article
      className={cn(
        "group border-border/70 bg-background hover:border-primary/40 flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(26,26,46,0.35)]",
        className,
      )}
    >
      <Link
        href={href}
        className="bg-surface focus-visible:ring-ring relative block aspect-square overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
          {product.isCombo && <BadgePill tone="brand">Combo</BadgePill>}
          {soldOut && <BadgePill tone="neutral">Sold out</BadgePill>}
          {lowStock && (
            <BadgePill tone="warning">Only {available} left</BadgePill>
          )}
        </div>

        {product.imageUrl ? (
          /* Product images are arbitrary remote URLs (Supabase storage or pasted
             links) and the rest of the storefront renders them the same way. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]",
              soldOut && "opacity-60 grayscale",
            )}
          />
        ) : (
          <ImagePlaceholder />
        )}

        {/* A single slow highlight passing over the photo on hover. It is the
            one flourish on the tile, and it reads as glass rather than as an
            animation, which is the point. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-linear-to-r from-transparent via-white/25 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[120%] motion-reduce:hidden"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link
          href={href}
          className="focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none"
        >
          <Typography
            as="h3"
            variant="body"
            className="font-heading group-hover:text-primary line-clamp-2 font-semibold transition-colors"
          >
            {product.title}
          </Typography>
        </Link>

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          <Price
            amount={product.price}
            currencyCode={currency.code}
            currencyLocale={currency.locale}
            size="md"
          />

          {showAddToCart &&
            (needsChoice ? (
              <Link
                href={href}
                className="border-border text-text-primary hover:border-primary hover:bg-primary hover:text-white focus-visible:ring-ring inline-flex h-9 w-full items-center justify-center rounded-full border text-xs font-bold tracking-wide transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                View options
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={soldOut}
                className="bg-primary hover:bg-primary/85 focus-visible:ring-ring inline-flex h-9 w-full items-center justify-center rounded-full text-xs font-bold tracking-wide text-white transition-all focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                {soldOut ? "Sold out" : "Add to cart"}
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
