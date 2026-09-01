"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, PackageCheck } from "lucide-react";
import { RowLink } from "@/components/molecules/admin";
import type { Product } from "@/types/product.types";

/** At or below this many available units, a product is flagged for reorder. */
export const LOW_STOCK_THRESHOLD = 5;

interface LowStockCardProps {
  products: Product[];
  /** Variant-stock totals keyed by product id (for `hasVariants` products). */
  variantStock: Record<string, { total: number; available: number }>;
}

/** Available units for a product, from its variants when it has them. */
function availableUnits(
  product: Product,
  variantStock: LowStockCardProps["variantStock"],
): number {
  if (product.hasVariants) return variantStock[product.id]?.available ?? 0;
  return product.available;
}

/** Products running low on stock, the soonest-to-run-out first. */
export function LowStockCard({ products, variantStock }: LowStockCardProps) {
  const low = products
    .map((p) => ({ product: p, available: availableUnits(p, variantStock) }))
    .filter((row) => row.available <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.available - b.available)
    .slice(0, 6);

  return (
    <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
      <div className="flex items-center justify-between border-b border-admin-border px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
          Low stock
        </p>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-admin-accent transition-colors hover:underline"
        >
          All products
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {low.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <PackageCheck className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="mt-3 text-sm font-semibold text-admin-text">
            Stock looks healthy
          </p>
          <p className="text-[11px] text-admin-text-muted">
            Nothing at or below {LOW_STOCK_THRESHOLD} units.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-admin-border">
          {low.map(({ product, available }) => {
            const out = available <= 0;
            return (
              <div
                key={product.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <RowLink
                  href={`/dashboard/products/${product.id}`}
                  label={`View ${product.title}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      out
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <p className="truncate text-sm font-semibold text-admin-text transition-colors group-hover:text-admin-accent">
                    {product.title}
                  </p>
                </RowLink>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    out
                      ? "bg-rose-500/10 text-rose-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {out ? "Out of stock" : `${available} left`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
