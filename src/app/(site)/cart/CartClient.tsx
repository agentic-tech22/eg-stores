"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cartItemKey, useCart } from "@/components/cart/cart-context";
import { formatCurrency } from "@/utils/format-currency";

interface CartClientProps {
  currency: { code: string; locale: string };
}

export function CartClient({ currency }: CartClientProps) {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  if (items.length === 0) {
    return (
      <Container size="md" className="py-24 text-center">
        <ShoppingBag className="mx-auto mb-6 h-16 w-16 text-text-secondary/30" />
        <Typography variant="h2" className="mb-3 italic">
          Your cart is empty
        </Typography>
        <Typography variant="bodyLarge" className="mb-8 text-text-secondary">
          Browse the collection and add something you love.
        </Typography>
        <Link
          href="/products"
          className="inline-flex rounded-full bg-secondary px-8 py-3 font-bold text-white transition-colors hover:bg-primary"
        >
          Shop products
        </Link>
      </Container>
    );
  }

  return (
    <Container size="md" className="py-16">
      <Typography variant="h1" className="mb-8 italic">
        Your Cart
      </Typography>

      <div className="space-y-4">
        {items.map((item) => {
          const key = cartItemKey(item.productId, item.productVariantId);
          const atMax =
            item.available !== undefined && item.quantity >= item.available;
          return (
            <div
              key={key}
              className="flex items-center gap-4 rounded-2xl border border-border/30 bg-surface/50 p-4"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-background">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-secondary/30">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-primary">{item.title}</p>
                {item.variantLabel && (
                  <p className="text-sm text-text-secondary">{item.variantLabel}</p>
                )}
                <p className="mt-1 text-sm font-semibold text-secondary">
                  {money(item.unitPrice)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQuantity(key, item.quantity - 1)}
                  aria-label="Decrease quantity"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-text-secondary transition-colors hover:border-secondary hover:text-secondary"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center font-bold text-text-primary">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(key, item.quantity + 1)}
                  disabled={atMax}
                  aria-label="Increase quantity"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-text-secondary transition-colors hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {atMax && (
                <span className="text-[11px] font-semibold text-secondary">
                  Max stock
                </span>
              )}

              <div className="w-24 text-right font-bold text-text-primary">
                {money(item.unitPrice * item.quantity)}
              </div>

              <button
                type="button"
                onClick={() => removeItem(key)}
                aria-label={`Remove ${item.title}`}
                className="text-text-secondary/50 transition-colors hover:text-secondary"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-end gap-4">
        <div className="flex w-full max-w-xs items-center justify-between text-lg">
          <span className="text-text-secondary">Subtotal</span>
          <span className="font-extrabold text-text-primary">{money(subtotal)}</span>
        </div>
        <Link
          href="/checkout"
          className="inline-flex rounded-full bg-secondary px-10 py-3 font-bold text-white shadow-lg transition-colors hover:bg-primary"
        >
          Proceed to checkout
        </Link>
      </div>
    </Container>
  );
}
