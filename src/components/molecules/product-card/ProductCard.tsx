"use client";

import Link from "next/link";
import { BadgePill } from "@/components/atoms/badge-pill/BadgePill";
import { Price } from "@/components/atoms/price/Price";
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
  /**
   * `plain` is the home page tile: photo, caps title, price, and a quick-add
   * button over the photo. `boxed` is the /products listing card: bordered,
   * with a full-width action under the price, so a dense grid reads as rows
   * of separate items and every card ends on the same line.
   */
  variant?: "plain" | "boxed";
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
  variant = "plain",
  className,
}: ProductCardProps) {
  const boxed = variant === "boxed";
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
        "group flex h-full flex-col",
        boxed &&
          "border-border bg-background hover:border-text-muted/60 rounded-xl border p-3 transition-[border-color,box-shadow] duration-300 hover:shadow-[0_12px_32px_-18px_rgba(17,24,39,0.35)] sm:p-4",
        className,
      )}
    >
      <div
        className={cn(
          "bg-surface relative aspect-square overflow-hidden",
          boxed ? "rounded-lg" : "rounded-xl",
        )}
      >
        <Link
          href={href}
          className="focus-visible:ring-ring block h-full w-full focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
          {product.imageUrl ? (
            /* Product images are arbitrary remote URLs (Supabase storage or
               pasted links) and the rest of the storefront renders them the
               same way. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]",
                soldOut && "opacity-60 grayscale",
              )}
            />
          ) : (
            <ImagePlaceholder />
          )}
        </Link>

        <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
          {product.isCombo && <BadgePill tone="brand">Combo</BadgePill>}
          {soldOut && <BadgePill tone="neutral">Sold out</BadgePill>}
          {lowStock && (
            <BadgePill tone="danger">Only {available} left</BadgePill>
          )}
        </div>

        {/* Quick add, over the corner of the photo. Kept visible rather than
            revealed on hover, because there is no hover on a phone. Products
            that need a choice first have no quick add: the tile itself is the
            way through to picking one. */}
        {showAddToCart && !boxed && !needsChoice && !soldOut && (
          <button
            type="button"
            onClick={handleAdd}
            aria-label={`Add ${product.title} to cart`}
            className="bg-background/95 text-text-primary hover:bg-primary focus-visible:ring-ring absolute right-2.5 bottom-2.5 z-10 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-md transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none active:scale-95"
          >
            <svg
              className="h-[18px] w-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-1.5",
          boxed ? "pt-4" : "pt-3",
        )}
      >
        <Link
          href={href}
          className="focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none"
        >
          <h3
            className={cn(
              "font-heading text-text-primary group-hover:text-primary line-clamp-2 leading-snug font-semibold transition-colors",
              boxed ? "text-sm" : "text-[13px] tracking-wide uppercase",
            )}
          >
            {product.title}
          </h3>
        </Link>

        <Price
          amount={product.price}
          currencyCode={currency.code}
          currencyLocale={currency.locale}
          size={boxed ? "md" : "sm"}
          tone="brand"
          className="mt-auto"
        />

        {showAddToCart && boxed && (
          <div className="pt-2.5">
            {needsChoice ? (
              <Link
                href={href}
                className="border-text-primary/80 text-text-primary hover:bg-text-primary hover:text-background focus-visible:ring-ring inline-flex h-10 w-full items-center justify-center rounded-md border text-xs font-bold tracking-[0.08em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                View options
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={soldOut}
                className="bg-primary hover:bg-secondary focus-visible:ring-ring disabled:bg-surface disabled:text-text-muted inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md text-xs font-bold tracking-[0.08em] text-white uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none"
              >
                {soldOut ? "Out of stock" : "Add to cart"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
