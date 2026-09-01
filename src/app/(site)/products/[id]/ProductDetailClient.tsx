"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ImageOff,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { useCart } from "@/components/cart/cart-context";
import { notify } from "@/lib/toast";
import type { ProductVariant, ProductWithVariants } from "@/types/product.types";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";

interface ProductDetailClientProps {
  product: ProductWithVariants;
  currency: { code: string; locale: string };
}

/** Below this many units we nudge the shopper with a "only N left" message. */
const LOW_STOCK_THRESHOLD = 5;

export function ProductDetailClient({ product, currency }: ProductDetailClientProps) {
  const allImages = [product.imageUrl, ...product.images].filter(Boolean) as string[];
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const router = useRouter();
  const { addItem } = useCart();

  const selectedVariant: ProductVariant | null = product.hasVariants
    ? (product.variants.find((v) => v.id === selectedVariantId) ?? null)
    : null;

  const unitPrice = selectedVariant
    ? (selectedVariant.priceOverride ?? product.price)
    : product.price;

  // Availability: variant-level when chosen, else product-level. Variant
  // products with nothing selected can't be added until a variant is picked.
  const available = product.hasVariants
    ? (selectedVariant?.available ?? null)
    : product.available;

  const canAdd = product.hasVariants
    ? Boolean(selectedVariant) && (selectedVariant?.available ?? 0) > 0
    : product.available > 0;

  const needsVariant = product.hasVariants && !selectedVariant;
  // Cap the stepper to what's actually buyable so we never let the shopper
  // request more than stock (the cart also clamps, but this keeps the UI honest).
  const maxQty = available ?? 1;
  const lowStock = available !== null && available > 0 && available <= LOW_STOCK_THRESHOLD;

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  /** Add the chosen variant/quantity to the cart. Returns false if blocked. */
  function commitToCart(): boolean {
    if (needsVariant) {
      notify.error("Please choose an option first.");
      return false;
    }
    addItem(
      {
        productId: product.id,
        productVariantId: selectedVariant?.id ?? null,
        title: product.title,
        variantLabel: selectedVariant?.displayName ?? null,
        unitPrice,
        imageUrl: selectedVariant?.imageUrl ?? product.imageUrl,
        available: available ?? undefined,
      },
      quantity,
    );
    return true;
  }

  function handleAddToCart() {
    if (commitToCart()) notify.success(`Added ${quantity} to cart.`);
  }

  function handleBuyNow() {
    if (commitToCart()) router.push("/checkout");
  }

  // Reset the requested quantity when switching variant so we don't carry a
  // count that exceeds the newly selected option's stock.
  function selectVariant(id: string) {
    setSelectedVariantId(id);
    setQuantity(1);
  }

  return (
    <section className="relative overflow-hidden py-10 lg:py-16">
      <div className="pointer-events-none absolute top-0 -left-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      <Container size="lg" className="relative z-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="transition-colors hover:text-secondary">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          <Link href="/products" className="transition-colors hover:text-secondary">Products</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          <span className="truncate font-medium text-text-primary">{product.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* ===================== GALLERY ===================== */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-sm">
              <div className="aspect-square w-full">
                {allImages.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={allImages[selectedImage]}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-secondary/40">
                    <ImageOff className="h-10 w-10" />
                    <span className="text-sm">No image available</span>
                  </div>
                )}
              </div>
            </div>

            {allImages.length > 1 && (
              <div className="mt-4 flex gap-3">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImage(i)}
                    aria-label={`View image ${i + 1}`}
                    className={cn(
                      "h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-all",
                      selectedImage === i
                        ? "border-secondary ring-2 ring-secondary/20"
                        : "border-border/60 opacity-70 hover:opacity-100",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===================== DETAILS ===================== */}
          <div className="flex flex-col">
            {/* Stock badge */}
            <div className="mb-4">
              {needsVariant ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                  Select an option to see availability
                </span>
              ) : available !== null && available > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                    lowStock
                      ? "bg-amber-50 text-amber-700"
                      : "bg-secondary/10 text-secondary",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {lowStock ? `Only ${available} left in stock` : "In stock"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-secondary/70">
                  Out of stock
                </span>
              )}
            </div>

            <Typography variant="h1" className="text-text-primary">
              {product.title}
            </Typography>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-heading text-4xl font-bold text-text-primary">
                {money(unitPrice)}
              </span>
              {selectedVariant?.displayName && (
                <span className="text-sm text-text-secondary">/ {selectedVariant.displayName}</span>
              )}
            </div>

            {(selectedVariant?.sku ?? product.sku) && (
              <p className="mt-2 text-xs uppercase tracking-wide text-text-secondary">
                SKU: {selectedVariant?.sku ?? product.sku}
              </p>
            )}

            {product.description && (
              <Typography variant="body" className="mt-5 leading-relaxed text-text-secondary">
                {product.description}
              </Typography>
            )}

            {/* Variant picker */}
            {product.hasVariants && (
              <div className="mt-7">
                <p className="mb-2.5 text-sm font-semibold text-text-primary">
                  {needsVariant ? "Choose an option" : "Option"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const out = v.available <= 0;
                    const active = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out}
                        onClick={() => selectVariant(v.id)}
                        className={cn(
                          "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                          active
                            ? "border-secondary bg-secondary/10 text-secondary"
                            : "border-border/60 text-text-secondary hover:border-secondary/50",
                          out && "cursor-not-allowed opacity-40 line-through",
                        )}
                      >
                        {v.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Buy box */}
            <div className="mt-8 rounded-3xl border border-border/60 bg-surface/60 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* Quantity stepper */}
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Quantity
                  </span>
                  <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-secondary/10 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center font-bold text-text-primary">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                      disabled={!canAdd || quantity >= maxQty}
                      aria-label="Increase quantity"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-secondary/10 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-1 gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!canAdd}
                    className="flex h-13 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-secondary px-5 text-sm font-bold text-secondary transition-all hover:bg-secondary/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingCart className="h-5 w-5" /> Add to cart
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={!canAdd}
                    className="flex h-13 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-secondary px-5 text-sm font-bold text-white shadow-lg shadow-secondary/25 transition-all hover:bg-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Buy now
                  </button>
                </div>
              </div>
            </div>

            {/* Reassurance / trust signals */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <Truck className="h-4 w-4 shrink-0 text-secondary" /> Cash on delivery
              </span>
              <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <ShieldCheck className="h-4 w-4 shrink-0 text-secondary" /> Secure checkout
              </span>
              <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <RotateCcw className="h-4 w-4 shrink-0 text-secondary" /> Easy returns
              </span>
            </div>

            <div className="mt-8 flex items-center gap-5 border-t border-border/60 pt-6">
              <Link href="/cart" className="group inline-flex items-center gap-1.5 text-sm font-bold text-secondary transition-colors hover:text-primary">
                View cart <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </Link>
              <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary transition-colors hover:text-secondary">
                Back to collection
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
