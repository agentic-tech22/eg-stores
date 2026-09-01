/**
 * POS "custom items", surfaced to users as EXTRA SALES: one-off sale lines for
 * things that aren't in the catalog — a service charge, repair labour, a
 * delivery fee. The cashier types a name, a unit price and a quantity; unlike
 * catalog lines these carry no product, no SKU and no cost, so they never touch
 * inventory.
 *
 * Because they have no cost to margin against, they are persisted to their own
 * `extra_sale_items` table rather than `sale_items`, and excluded from product
 * revenue and profit everywhere. They are reported on their own under
 * Point of Sale → Extra Sales. See `saleAmountSplit` in `types/sale.types.ts`
 * for how one bill divides between the two.
 *
 * Validation lives here rather than in the form so the sale engine can re-run
 * exactly the same rules server-side. That matters more than usual for these
 * lines: the client-supplied price is the only price there is (there's no
 * catalog to price against), so the server check is the one that counts.
 */

/** Longest accepted item name. */
export const CUSTOM_ITEM_TITLE_MAX = 120;
/** Unit-price ceiling: keeps a line inside `sale_items.unit_price NUMERIC(10,2)`. */
export const CUSTOM_ITEM_PRICE_MAX = 9_999_999;
/** Quantity ceiling: a typo guard; real POS lines are far smaller. */
export const CUSTOM_ITEM_QTY_MAX = 100_000;
/** Ceiling for unitPrice × quantity, the limit of `sale_items.line_total NUMERIC(10,2)`. */
export const CUSTOM_ITEM_LINE_TOTAL_MAX = 99_999_999.99;

/** Raw input, as typed in the form (strings) or received over the wire (numbers). */
export interface CustomItemDraft {
  title: string;
  unitPrice: string | number;
  quantity: string | number;
}

/** A validated custom line: trimmed name, price rounded to the stored precision. */
export interface CustomItemValue {
  title: string;
  unitPrice: number;
  quantity: number;
}

/** Per-field messages, keyed so the form can show them under the right input. */
export interface CustomItemErrors {
  title?: string;
  unitPrice?: string;
  quantity?: string;
}

/** Parse a form string or raw number, rejecting blanks and non-numeric input. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Round to the 2 decimals the money columns store. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatLimit(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Validate one custom item. Returns per-field errors plus the normalized value,
 * which is non-null only when every field passed. Inputs are treated as
 * untrusted (this also runs on the server), so types are coerced defensively.
 */
export function validateCustomItem(draft: CustomItemDraft): {
  errors: CustomItemErrors;
  value: CustomItemValue | null;
} {
  const errors: CustomItemErrors = {};

  // Collapse runs of whitespace so "  Repair   fee " reads as "Repair fee" on
  // the receipt and in the sales list.
  const title =
    typeof draft?.title === "string" ? draft.title.trim().replace(/\s+/g, " ") : "";
  if (!title) {
    errors.title = "Enter an item name.";
  } else if (title.length > CUSTOM_ITEM_TITLE_MAX) {
    errors.title = `Keep the name under ${CUSTOM_ITEM_TITLE_MAX} characters.`;
  }

  const price = toNumber(draft?.unitPrice);
  if (price === null) {
    errors.unitPrice = "Enter a unit price.";
  } else if (price <= 0) {
    errors.unitPrice = "Unit price must be greater than 0.";
  } else if (price > CUSTOM_ITEM_PRICE_MAX) {
    errors.unitPrice = `Unit price can't exceed ${formatLimit(CUSTOM_ITEM_PRICE_MAX)}.`;
  }

  const quantity = toNumber(draft?.quantity);
  if (quantity === null) {
    errors.quantity = "Enter a quantity.";
  } else if (!Number.isInteger(quantity)) {
    errors.quantity = "Quantity must be a whole number.";
  } else if (quantity < 1) {
    errors.quantity = "Quantity must be at least 1.";
  } else if (quantity > CUSTOM_ITEM_QTY_MAX) {
    errors.quantity = `Quantity can't exceed ${formatLimit(CUSTOM_ITEM_QTY_MAX)}.`;
  }

  // Guard the line total separately: each field can be in range while their
  // product overflows the NUMERIC(10,2) column and fails the insert.
  const unitPrice = price === null ? null : round2(price);
  if (!errors.unitPrice && !errors.quantity && unitPrice !== null && quantity !== null) {
    if (unitPrice * quantity > CUSTOM_ITEM_LINE_TOTAL_MAX) {
      errors.quantity = "This line's total is too large. Split it across several items.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: { title, unitPrice: unitPrice as number, quantity: quantity as number },
  };
}

/** First error message in field order, for callers that show a single message. */
export function firstCustomItemError(errors: CustomItemErrors): string | null {
  return errors.title ?? errors.unitPrice ?? errors.quantity ?? null;
}
