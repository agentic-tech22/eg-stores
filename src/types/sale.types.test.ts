import { describe, it, expect } from "vitest";
import {
  SALE_CHANNELS,
  saleAmountSplit,
  saleExtrasRevenue,
  saleItemsLabel,
  saleProfit,
  saleQuantity,
  saleChannelLabel,
  saleRevenue,
  type ExtraSaleItem,
  type Sale,
  type SaleItem,
} from "./sale.types";

const item = (over: Partial<SaleItem>): SaleItem =>
  ({
    id: "i1",
    saleId: "s1",
    productId: "p1",
    productVariantId: null,
    productTitle: "Widget",
    variantLabel: null,
    sku: null,
    quantity: 1,
    unitPrice: 0,
    costAtSale: 0,
    lineTotal: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  }) as SaleItem;

const extra = (over: Partial<ExtraSaleItem>): ExtraSaleItem =>
  ({
    id: "e1",
    saleId: "s1",
    title: "Repair fee",
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  }) as ExtraSaleItem;

const sale = (items: SaleItem[], discountAmount = 0): Sale =>
  ({ items, discountAmount }) as Sale;

/** A sale carrying both catalog lines and extra (non-catalog) lines. */
const mixedSale = (
  items: SaleItem[],
  extras: ExtraSaleItem[],
  discountAmount = 0,
): Sale => ({ items, extras, discountAmount }) as Sale;

describe("saleQuantity", () => {
  it("sums the quantity across all line items", () => {
    expect(saleQuantity(sale([item({ quantity: 2 }), item({ quantity: 3 })]))).toBe(5);
  });
  it("is 0 when there are no items", () => {
    expect(saleQuantity(sale([]))).toBe(0);
  });
});

describe("saleProfit", () => {
  it("is sum of (unitPrice - costAtSale) * qty, minus the discount", () => {
    const s = sale(
      [
        item({ unitPrice: 100, costAtSale: 60, quantity: 2 }), // 80
        item({ unitPrice: 50, costAtSale: 20, quantity: 1 }), // 30
      ],
      10,
    );
    expect(saleProfit(s)).toBe(80 + 30 - 10);
  });

  it("can be negative when the discount exceeds the margin", () => {
    const s = sale([item({ unitPrice: 100, costAtSale: 90, quantity: 1 })], 50);
    expect(saleProfit(s)).toBe(10 - 50);
  });

  it("ignores extra lines, which have no cost to margin against", () => {
    const s = mixedSale(
      [item({ unitPrice: 100, costAtSale: 60, quantity: 1, lineTotal: 100 })],
      [extra({ unitPrice: 400, quantity: 1, lineTotal: 400 })],
    );
    // 40 from the product; the 400 service charge is NOT pure profit here.
    expect(saleProfit(s)).toBe(40);
  });
});

/**
 * The split is what stops extra sales from distorting product P&L, so the cases
 * that matter are the boundaries: no extras at all (must behave exactly as
 * before), and extras carrying a share of a sale-level discount.
 */
describe("saleAmountSplit", () => {
  it("gives the whole discount to the catalog side when there are no extras", () => {
    const s = sale([item({ lineTotal: 1000 })], 100);
    const split = saleAmountSplit(s);
    expect(split.extrasSubtotal).toBe(0);
    expect(split.extrasDiscount).toBe(0);
    expect(split.itemsDiscount).toBe(100);
    expect(split.itemsRevenue).toBe(900);
  });

  it("splits the discount in proportion to each side's share of the cart", () => {
    // 750 products + 250 extras = 1000 gross; a 100 discount splits 75 / 25.
    const s = mixedSale(
      [item({ lineTotal: 750 })],
      [extra({ lineTotal: 250 })],
      100,
    );
    const split = saleAmountSplit(s);
    expect(split.itemsDiscount).toBe(75);
    expect(split.extrasDiscount).toBe(25);
    expect(split.itemsRevenue).toBe(675);
    expect(split.extrasRevenue).toBe(225);
  });

  it("keeps the two shares adding back up to the discount", () => {
    // A third/two-thirds split can't be represented exactly in cents, so the
    // catalog side takes the remainder rather than its own rounded proportion.
    const s = mixedSale(
      [item({ lineTotal: 100 })],
      [extra({ lineTotal: 200 })],
      10,
    );
    const split = saleAmountSplit(s);
    expect(split.itemsDiscount + split.extrasDiscount).toBe(10);
    expect(split.itemsRevenue + split.extrasRevenue).toBe(290);
  });

  it("never charges a discount to a side that sold nothing", () => {
    // An extras-only sale would otherwise post a negative product profit
    // against zero product revenue.
    const s = mixedSale([], [extra({ lineTotal: 500 })], 50);
    expect(saleProfit(s)).toBe(0);
    expect(saleRevenue(s)).toBe(0);
    expect(saleExtrasRevenue(s)).toBe(450);
  });
});

describe("saleItemsLabel", () => {
  it("lists extras alongside the products", () => {
    const s = mixedSale(
      [item({ productTitle: "Widget", quantity: 2 })],
      [extra({ title: "Repair fee", quantity: 1 })],
    );
    expect(saleItemsLabel(s)).toBe("Widget ×2, Repair fee ×1");
  });

  it("still reads N/A when a sale has neither kind of line", () => {
    expect(saleItemsLabel(mixedSale([], []))).toBe("N/A");
  });
});

describe("saleChannelLabel", () => {
  it("labels every selectable channel", () => {
    expect(saleChannelLabel("shop")).toBe("Shop");
    expect(saleChannelLabel("online")).toBe("Online");
  });

  it("covers every value in SALE_CHANNELS", () => {
    for (const c of SALE_CHANNELS) {
      expect(saleChannelLabel(c.value)).toBe(c.label);
    }
  });

  it("falls back to the raw value for anything unrecognized", () => {
    // Rows written before a future channel is removed still have to render.
    expect(saleChannelLabel("marketplace" as never)).toBe("marketplace");
  });
});
