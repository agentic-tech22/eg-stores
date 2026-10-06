"use client";

import Link from "next/link";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { CheckoutSteps } from "@/components/molecules/checkout-steps/CheckoutSteps";
import { PageHead } from "@/components/sections/page-head/PageHead";
import { cartItemKey, useCart } from "@/components/cart/cart-context";
import { formatCurrency } from "@/utils/format-currency";

interface CartClientProps {
  currency: { code: string; locale: string };
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="bg-surface border-border/70 h-20 w-20 shrink-0 overflow-hidden rounded-xl border sm:h-24 sm:w-24">
      {src ? (
        /* Product images are arbitrary remote URLs, as everywhere else on the
           storefront. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="text-text-secondary/30 flex h-full w-full items-center justify-center">
          <ShoppingBag className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}

export function CartClient({ currency }: CartClientProps) {
  const { items, subtotal, count, updateQuantity, removeItem } = useCart();
  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  if (items.length === 0) {
    return (
      <>
        <PageHead
          eyebrow="Your bag"
          title="Cart"
          meta={<CheckoutSteps current="cart" />}
        />
        <section className="py-16 lg:py-24">
          <Container>
            {/* The same dashed empty card the product grid falls back to. */}
            <div className="border-border/70 mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
              <ShoppingBag className="text-text-secondary/30 h-12 w-12" />
              <Typography variant="h3" className="text-text-primary">
                Your cart is empty
              </Typography>
              <Typography variant="body" className="text-text-secondary">
                Nothing in here yet. Have a look at what is on the shelves.
              </Typography>
              <Link
                href="/products"
                className="bg-primary hover:bg-primary/85 mt-2 inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-bold tracking-wide text-white transition-all active:scale-[0.98]"
              >
                Browse the shop
              </Link>
            </div>
          </Container>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Your bag"
        title="Cart"
        meta={<CheckoutSteps current="cart" />}
      />

      <section className="py-8 lg:py-12">
        <Container>
          {/* Items beside a sticky summary, the same shape as the product
              grid's rail-and-content layout. */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="flex flex-col gap-3">
              <Typography variant="bodySmall" className="text-text-secondary">
                {count} {count === 1 ? "item" : "items"}
              </Typography>

              <ul className="flex flex-col gap-3">
                {items.map((item) => {
                  const key = cartItemKey(item.productId, item.productVariantId);
                  const atMax =
                    item.available !== undefined &&
                    item.quantity >= item.available;
                  return (
                    <li
                      key={key}
                      className="border-border/70 bg-background hover:border-primary/40 flex gap-4 rounded-2xl border p-4 transition-colors"
                    >
                      <Link href={`/products/${item.productId}`}>
                        <Thumb src={item.imageUrl} alt={item.title} />
                      </Link>

                      {/* Stacks under the title on a phone rather than
                          competing with it for the same row. */}
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/products/${item.productId}`}
                              className="hover:text-primary transition-colors"
                            >
                              <Typography
                                as="p"
                                variant="body"
                                className="font-heading text-text-primary line-clamp-2 font-semibold"
                              >
                                {item.title}
                              </Typography>
                            </Link>
                            {item.variantLabel && (
                              <Typography
                                variant="bodySmall"
                                className="text-text-secondary"
                              >
                                {item.variantLabel}
                              </Typography>
                            )}
                            <Typography
                              variant="bodySmall"
                              className="text-text-secondary mt-1"
                            >
                              {money(item.unitPrice)} each
                            </Typography>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(key)}
                            aria-label={`Remove ${item.title}`}
                            className="text-text-secondary/50 hover:bg-surface hover:text-destructive flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                          <div className="border-border/70 flex items-center gap-1 rounded-full border p-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(key, item.quantity - 1)
                              }
                              aria-label="Decrease quantity"
                              className="text-text-secondary hover:bg-surface hover:text-primary flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-text-primary w-7 text-center text-sm font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(key, item.quantity + 1)
                              }
                              disabled={atMax}
                              aria-label="Increase quantity"
                              className="text-text-secondary hover:bg-surface hover:text-primary flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            {atMax && (
                              <Typography
                                as="span"
                                variant="caption"
                                className="text-text-secondary"
                              >
                                Max stock
                              </Typography>
                            )}
                            <span className="font-heading text-text-primary text-base font-bold">
                              {money(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Summary */}
            <div className="border-border/70 bg-surface rounded-2xl border p-5 lg:sticky lg:top-28">
              <Typography
                as="h2"
                variant="body"
                className="font-heading text-text-primary font-bold"
              >
                Order summary
              </Typography>

              <dl className="border-border/70 mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="text-text-secondary flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="text-text-primary font-semibold">
                    {money(subtotal)}
                  </dd>
                </div>
                <div className="text-text-secondary flex justify-between">
                  <dt>Delivery</dt>
                  <dd>Confirmed at checkout</dd>
                </div>
              </dl>

              <Link
                href="/checkout"
                className="bg-primary hover:bg-primary/85 mt-5 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-xs font-bold tracking-wide text-white transition-all active:scale-[0.98]"
              >
                Proceed to checkout
              </Link>

              <Link
                href="/products"
                className="text-text-secondary hover:text-primary mt-3 inline-flex w-full items-center justify-center text-xs font-semibold transition-colors"
              >
                Continue shopping
              </Link>

              <p className="text-text-secondary/80 mt-5 inline-flex items-center gap-1.5 text-xs">
                <ShieldCheck className="text-primary h-3.5 w-3.5" />
                eSewa or cash on delivery
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
