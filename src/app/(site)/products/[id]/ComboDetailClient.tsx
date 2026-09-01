"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart, Truck, ShieldCheck } from "lucide-react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { useCart } from "@/components/cart/cart-context";
import { notify } from "@/lib/toast";
import type { ComboWithItems } from "@/types/product.types";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";

interface ComboDetailClientProps {
  combo: ComboWithItems;
  currency: { code: string; locale: string };
}

export function ComboDetailClient({ combo, currency }: ComboDetailClientProps) {
  const allImages = [combo.imageUrl, ...combo.images].filter(Boolean) as string[];
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const router = useRouter();
  const { addItem } = useCart();
  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  const available = combo.comboAvailable;
  const canAdd = available > 0;
  const hasDiscount = combo.originalPrice > combo.price;
  const savings = combo.originalPrice - combo.price;

  function commitToCart() {
    addItem(
      {
        productId: combo.id,
        productVariantId: null,
        title: combo.title,
        variantLabel: null,
        unitPrice: combo.price,
        imageUrl: combo.imageUrl,
        available,
      },
      quantity,
    );
  }

  function handleAddToCart() {
    commitToCart();
    notify.success(`Added ${quantity} to cart.`);
  }

  function handleBuyNow() {
    commitToCart();
    router.push("/checkout");
  }

  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
      <div className="pointer-events-none absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      <Container size="md" className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-block rounded-full bg-secondary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-secondary">
            Combo Deal
          </span>

          <div className="relative mb-8 h-64 w-64 overflow-hidden rounded-full bg-background shadow-xl md:h-80 md:w-80">
            {allImages.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={allImages[selectedImage]} alt={combo.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-secondary/20">No Image</div>
            )}
          </div>

          {allImages.length > 1 && (
            <div className="mb-8 flex gap-3">
              {allImages.map((img, i) => (
                <button key={i} type="button" onClick={() => setSelectedImage(i)} className={cn("h-16 w-16 overflow-hidden rounded-full border-4 shadow-lg transition-transform hover:-translate-y-1 md:h-20 md:w-20", selectedImage === i ? "border-secondary" : "border-background opacity-60")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <Typography variant="h1" className="mb-4 italic bg-linear-to-r from-text-primary via-secondary to-primary bg-clip-text text-transparent box-decoration-clone px-1">{combo.title}</Typography>

          <div className="mb-6 flex flex-wrap items-baseline justify-center gap-3">
            <Typography variant="h3" className="italic text-secondary">{money(combo.price)}</Typography>
            {hasDiscount && (
              <>
                <span className="text-lg text-text-secondary/60 line-through">{money(combo.originalPrice)}</span>
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                  Save {money(savings)}
                </span>
              </>
            )}
          </div>

          {combo.sku && (
            <p className="mb-4 text-xs uppercase tracking-wide text-text-secondary">SKU: {combo.sku}</p>
          )}

          {combo.description && <Typography variant="bodyLarge" className="mx-auto mb-8 max-w-xl italic leading-relaxed text-text-secondary">{combo.description}</Typography>}

          {/* What's included */}
          <div className="mb-8 w-full max-w-md rounded-2xl border border-border/40 bg-background/60 p-5 text-left backdrop-blur-sm">
            <Typography variant="label" className="mb-3 block tracking-widest text-secondary">What&apos;s included</Typography>
            <ul className="space-y-2">
              {combo.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">
                    <span className="font-bold text-secondary">{it.quantity}×</span>{" "}
                    {it.component?.title ?? "Product"}
                  </span>
                  {it.component && (
                    <span className="text-text-secondary/70">{money(it.component.price * it.quantity)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Availability */}
          <div className="mb-5 flex flex-col items-center gap-1">
            {available > 0 ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary">
                <Check className="h-4 w-4" />
                {available <= 5 ? `Only ${available} left in stock` : "In stock"}
              </p>
            ) : (
              <p className="text-sm font-medium text-text-secondary/60">Out of stock</p>
            )}
          </div>

          {/* Quantity + actions */}
          <div className="mb-5 flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-text-primary">Quantity</span>
              <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-secondary/10 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center font-bold text-text-primary">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, available), q + 1))}
                  disabled={!canAdd || quantity >= available}
                  aria-label="Increase quantity"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-secondary/10 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canAdd}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-secondary px-8 py-3 font-bold text-secondary transition-all hover:bg-secondary/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingCart className="h-5 w-5" /> Add to cart
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canAdd}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-secondary px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Buy now
              </button>
            </div>
          </div>

          {/* Reassurance / trust signals */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-secondary" /> Cash on delivery available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-secondary" /> Secure checkout
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/cart" className="group flex items-center gap-1.5 font-bold text-secondary transition-colors hover:text-primary">
              View cart <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
            <Link href="/products" className="group flex items-center gap-1.5 font-bold text-text-secondary transition-colors hover:text-secondary">
              Back to Collection
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
