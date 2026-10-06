import type {
  ComboWithItems,
  Product,
  ProductWithVariants,
  PublicComboWithItems,
  PublicProduct,
  PublicProductWithVariants,
} from "@/types/product.types";

/**
 * Drop `costPrice` before a product crosses into a client component.
 *
 * Hiding cost in the UI is not enough: props to a client component are
 * serialized into the RSC payload and are readable in the page source. This is
 * the one place that strips it, so a new public surface only has to remember to
 * call it rather than re-derive which fields are sensitive.
 */
export function toPublicProduct(product: Product): PublicProduct {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    costPrice,
    ...publicFields
  } = product;
  return publicFields;
}

/** Convenience for lists. */
export function toPublicProducts(products: Product[]): PublicProduct[] {
  return products.map(toPublicProduct);
}

/** Same, for a product loaded with its variants. Variants carry no cost. */
export function toPublicProductWithVariants(
  product: ProductWithVariants,
): PublicProductWithVariants {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    costPrice,
    ...publicFields
  } = product;
  return publicFields;
}

/**
 * Same, for a combo. Each item embeds a full component product, so those have
 * to be stripped too — the combo's own cost is not the only one in the tree.
 */
export function toPublicCombo(combo: ComboWithItems): PublicComboWithItems {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    costPrice,
    items,
    ...publicFields
  } = combo;
  return {
    ...publicFields,
    items: items.map((item) => ({
      ...item,
      component: item.component ? toPublicProduct(item.component) : undefined,
    })),
  };
}
