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
        className="h-14 w-14"
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
        "group border-border/60 bg-background hover:border-primary/30 hover:shadow-primary/5 flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        className,
      )}
    >
      <Link
        href={href}
        className="bg-surface focus-visible:ring-ring relative block aspect-square overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-2">
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
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <ImagePlaceholder />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <Link
          href={href}
          className="focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          <Typography
            as="h3"
            variant="h4"
            className="group-hover:text-primary line-clamp-2 transition-colors"
          >
            {product.title}
          </Typography>
        </Link>

        {product.description && (
          <Typography
            variant="bodySmall"
            className="text-text-secondary line-clamp-2"
          >
            {product.description}
          </Typography>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
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
                className="border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:ring-ring inline-flex h-9 items-center justify-center rounded-full border px-4 text-xs font-bold tracking-wide transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                View options
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={soldOut}
                className="bg-primary hover:bg-primary/85 focus-visible:ring-ring inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-bold tracking-wide text-white transition-all focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
              >
                {soldOut ? "Sold out" : "Add to cart"}
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
