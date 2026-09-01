/**
 * Works out which on-hand units a product save would retire, so the form can
 * warn before doing it.
 *
 * A product holds stock in exactly one shape: on the product row (simple) or
 * spread across its variants. Changing shape, or dropping a variant, zeroes
 * whatever the outgoing shape held. That is deliberate (the alternative is
 * orphaned `warehouse_stock` rows nothing counts), but it is irreversible, so
 * the user gets to see exactly what disappears first.
 *
 * Pure and free of React/server imports so the modal and the tests can both use
 * it. Mirrors the branches in `product-stock-engine`; keep the two in step.
 */

/** The shape this helper needs from a saved product. */
export interface StockAtRiskProduct {
  title: string;
  hasVariants: boolean;
  stockQuantity: number;
}

/** The shape this helper needs from an existing variant. */
export interface StockAtRiskVariant {
  id: string;
  displayName: string;
  stockQuantity: number;
}

export interface StockAtRiskArgs {
  /** Null when creating: a new product has no stock to lose. */
  product: StockAtRiskProduct | null;
  /** Variants as they exist in the database right now. */
  existingVariants: StockAtRiskVariant[];
  /** Whether the submitted form has variants turned on. */
  nextHasVariants: boolean;
  /** Ids still present in the editor. Anything missing is being removed. */
  keptVariantIds: string[];
}

function describe(label: string, quantity: number): string {
  return `${quantity} on hand against "${label}"`;
}

/**
 * Human-readable lines describing the stock this save would clear. Empty when
 * nothing is at risk, which is the normal case: creating a product, editing
 * fields without touching the shape, or converting while everything sits at 0.
 */
export function stockAtRisk(args: StockAtRiskArgs): string[] {
  const { product, existingVariants, nextHasVariants, keptVariantIds } = args;
  if (!product) return [];

  // Simple -> variants: the product's own on-hand count is retired.
  if (!product.hasVariants && nextHasVariants) {
    return product.stockQuantity > 0
      ? [describe(product.title, product.stockQuantity)]
      : [];
  }

  // Variants -> simple: every live variant is cleared and archived.
  if (product.hasVariants && !nextHasVariants) {
    return existingVariants
      .filter((v) => v.stockQuantity > 0)
      .map((v) => describe(v.displayName, v.stockQuantity));
  }

  // Still a variant product: only the variants removed in the editor go.
  if (product.hasVariants && nextHasVariants) {
    const kept = new Set(keptVariantIds);
    return existingVariants
      .filter((v) => !kept.has(v.id) && v.stockQuantity > 0)
      .map((v) => describe(v.displayName, v.stockQuantity));
  }

  // Simple -> simple: the stock field is edited directly and audited as an
  // ordinary change, so nothing is being silently discarded.
  return [];
}
