import { describe, expect, it } from "vitest";
import type { InvoiceRow } from "@/types/invoice.types";
import type { ExtraSaleItem, Sale, SaleItem } from "@/types/sale.types";
import { toCsv } from "./csv";
import {
  flattenInvoiceLines,
  flattenSaleLines,
  saleColumns,
  saleLineColumns,
} from "./columns";

/**
 * The flatteners decide what appears in the file at all, so the risk they carry
 * is silent omission — a sale that has no line items dropping out of the
 * per-item export and quietly failing to reconcile against the summary one.
 * These tests pin that behaviour, plus the money maths the columns derive.
 */

function saleItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: "item-1",
    saleId: "sale-1",
    productId: "prod-1",
    productVariantId: null,
    productTitle: "Cotton Shirt",
    variantLabel: null,
    sku: "SH-1",
    quantity: 2,
    unitPrice: 1000,
    costAtSale: 600,
    lineTotal: 2000,
    createdAt: "2026-08-09T10:00:00Z",
    ...overrides,
  };
}

function extraItem(overrides: Partial<ExtraSaleItem> = {}): ExtraSaleItem {
  return {
    id: "extra-1",
    saleId: "sale-1",
    title: "Repair fee",
    quantity: 1,
    unitPrice: 500,
    lineTotal: 500,
    createdAt: "2026-08-09T10:00:00Z",
    ...overrides,
  };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    saleNumber: 1,
    customerName: "Ram",
    customerPhone: "9800000000",
    customerId: null,
    paymentMethod: "cash",
    channel: "shop",
    paymentStatus: "paid",
    fonepayPrn: null,
    fonepayTraceId: null,
    warehouseId: "wh-1",
    subtotal: 2000,
    discountAmount: 0,
    total: 2000,
    saleDate: "2026-08-09",
    notes: null,
    createdAt: "2026-08-09T10:00:00Z",
    updatedAt: "2026-08-09T10:00:00Z",
    createdBy: null,
    createdByEmail: "staff@shop.com",
    items: [saleItem()],
    extras: [],
    payments: [],
    orderId: null,
    orderNumber: null,
    ...overrides,
  };
}

describe("flattenSaleLines", () => {
  it("emits one row per item, numbered from 1", () => {
    const lines = flattenSaleLines([
      sale({
        items: [
          saleItem({ id: "a" }),
          saleItem({ id: "b" }),
          saleItem({ id: "c" }),
        ],
      }),
    ]);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.lineNumber)).toEqual([1, 2, 3]);
    expect(lines.map((l) => l.item?.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps a line-less sale as one placeholder row", () => {
    const lines = flattenSaleLines([sale({ items: [], extras: [] })]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.item).toBeNull();
    expect(lines[0]!.extra).toBeNull();
    expect(lines[0]!.lineNumber).toBe(0);
  });

  it("tolerates undefined items and extras arrays", () => {
    const lines = flattenSaleLines([
      sale({ items: undefined, extras: undefined }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.item).toBeNull();
  });

  it("emits extra-sale rows after the products, numbered continuously", () => {
    const lines = flattenSaleLines([
      sale({
        items: [saleItem({ id: "a" }), saleItem({ id: "b" })],
        extras: [extraItem({ id: "x" })],
      }),
    ]);

    expect(lines.map((l) => l.lineNumber)).toEqual([1, 2, 3]);
    expect(lines[2]!.item).toBeNull();
    expect(lines[2]!.extra?.id).toBe("x");
  });

  it("emits extras even when the sale has no catalog products at all", () => {
    const lines = flattenSaleLines([
      sale({ items: [], extras: [extraItem()] }),
    ]);
    // Not the placeholder row: there IS a line, it just isn't a product.
    expect(lines).toHaveLength(1);
    expect(lines[0]!.lineNumber).toBe(1);
    expect(lines[0]!.extra).not.toBeNull();
  });

  it("leaves the line columns blank on a placeholder row", () => {
    const csv = toCsv(
      flattenSaleLines([sale({ items: [], extras: [] })]),
      saleLineColumns("NPR"),
    );
    const header = csv.split("\r\n")[0]!.split(",");
    const cells = csv.split("\r\n")[1]!.split(",");
    const at = (name: string) => cells[header.indexOf(name)];
    // Sale # is present; nothing that describes a line is.
    expect(cells[0]).toBe("1");
    expect(at("Type")).toBe("");
    expect(at("Product")).toBe("");
    expect(at("Quantity")).toBe("");
  });
});

describe("saleLineColumns", () => {
  it("computes gross line profit as (price - cost) x qty", () => {
    const csv = toCsv(
      flattenSaleLines([sale({ items: [saleItem()] })]),
      saleLineColumns("NPR"),
    );
    // (1000 - 600) * 2 = 800
    expect(csv).toContain("800.00");
  });

  it("ignores the sale-level discount — that belongs to the summary export", () => {
    const discounted = sale({ discountAmount: 500, total: 1500 });
    const csv = toCsv(flattenSaleLines([discounted]), saleLineColumns("NPR"));
    expect(csv).toContain("800.00");
    expect(csv).not.toContain("300.00");
  });

  it("tags money headers with the currency code", () => {
    const headers = saleLineColumns("INR").map((c) => c.header);
    expect(headers).toContain("Unit Price (INR)");
    expect(headers).toContain("Line Profit (INR)");
  });

  it("blanks cost and profit on an extra-sale row rather than writing 0", () => {
    // A 0 cost would read as a measured cost and make the line look like pure
    // margin — the exact distortion extra sales were separated out to avoid.
    const csv = toCsv(
      flattenSaleLines([sale({ items: [], extras: [extraItem()] })]),
      saleLineColumns("NPR"),
    );
    const header = csv.split("\r\n")[0]!.split(",");
    const cells = csv.split("\r\n")[1]!.split(",");
    const at = (name: string) => cells[header.indexOf(name)];

    expect(at("Type")).toBe("Extra sale");
    expect(at("Product")).toBe("Repair fee");
    expect(at("Line Total (NPR)")).toBe("500.00");
    expect(at("Unit Cost (NPR)")).toBe("");
    expect(at("Line Profit (NPR)")).toBe("");
  });
});

describe("saleColumns", () => {
  it("nets the discount off profit", () => {
    const csv = toCsv([sale({ discountAmount: 200 })], saleColumns("NPR"));
    // gross 800 - discount 200
    expect(csv).toContain("600.00");
  });

  it("summarises line items without the 'N/A' placeholder", () => {
    const withItems = toCsv([sale()], saleColumns("NPR"));
    expect(withItems).toContain("Cotton Shirt ×2");

    const empty = toCsv([sale({ items: [] })], saleColumns("NPR"));
    expect(empty).not.toContain("N/A");
  });

  it("splits the total into product revenue and extra sales", () => {
    const mixed = sale({
      extras: [extraItem()], // 500 on top of the 2000 of products
      subtotal: 2500,
      total: 2500,
    });
    const header = toCsv([mixed], saleColumns("NPR")).split("\r\n")[0]!.split(",");
    const cells = toCsv([mixed], saleColumns("NPR")).split("\r\n")[1]!.split(",");
    const at = (name: string) => cells[header.indexOf(name)];

    expect(at("Product Revenue (NPR)")).toBe("2000.00");
    expect(at("Extra Sales (NPR)")).toBe("500.00");
    expect(at("Extra Items")).toBe("Repair fee ×1");
    // Profit stays the product margin: (1000 - 600) * 2, untouched by the 500.
    expect(at("Profit (NPR)")).toBe("800.00");
  });
});

describe("flattenInvoiceLines", () => {
  const invoice: InvoiceRow = {
    id: "inv-1",
    sale_id: "sale-1",
    invoice_number: "INV-0001",
    issue_date: "2026-08-09",
    due_date: null,
    status: "issued",
    subtotal: 2000,
    discount_amount: 0,
    total_amount: 2000,
    customer_name: "Ram",
    customer_phone: null,
    notes: null,
    created_at: "2026-08-09T10:00:00Z",
    updated_at: "2026-08-09T10:00:00Z",
    invoice_items: [
      {
        id: "ii-2",
        invoice_id: "inv-1",
        product_title: "Second",
        variant_label: null,
        sku: null,
        quantity: 1,
        unit_price: 500,
        line_total: 500,
        sort_order: 2,
        created_at: "2026-08-09T10:00:00Z",
      },
      {
        id: "ii-1",
        invoice_id: "inv-1",
        product_title: "First",
        variant_label: null,
        sku: null,
        quantity: 1,
        unit_price: 1500,
        line_total: 1500,
        sort_order: 1,
        created_at: "2026-08-09T10:00:00Z",
      },
    ],
  };

  it("orders lines by sort_order, not by the embed's arrival order", () => {
    const lines = flattenInvoiceLines([invoice]);
    expect(lines.map((l) => l.item?.product_title)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("keeps an item-less invoice as one placeholder row", () => {
    const lines = flattenInvoiceLines([{ ...invoice, invoice_items: [] }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.item).toBeNull();
  });
});
