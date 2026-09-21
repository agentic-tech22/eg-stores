import { describe, it, expect } from "vitest";
import { orderDeleteBlocker, type Order } from "./order.types";

/** A cancelled order that released its stock — the deletable baseline. */
const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "o1",
    orderNumber: 42,
    customerName: "Ram",
    customerPhone: "9800000000",
    customerPhone2: null,
    customerAddress: "Kathmandu",
    status: "cancelled",
    source: "admin",
    channel: "online",
    warehouseId: "w1",
    paymentMethod: "cod",
    paymentStatus: "unpaid",
    esewaTransactionCode: null,
    esewaTransactionUuid: null,
    subtotal: 1000,
    discountAmount: 0,
    codCharge: 0,
    total: 1000,
    notes: null,
    ncmOrderId: null,
    ncmStatus: null,
    ncmFromBranch: null,
    ncmToBranch: null,
    ncmDeliveryType: null,
    ncmSyncedAt: null,
    ncmShippedAt: null,
    ncmDeliveredAt: null,
    stockCommitted: false,
    stockReleased: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    convertedSale: null,
    ...over,
  }) as Order;

describe("orderDeleteBlocker", () => {
  it("allows a cancelled order that released its stock", () => {
    expect(orderDeleteBlocker(order())).toBeNull();
  });

  it("allows a cancelled order that never reserved stock either way", () => {
    expect(
      orderDeleteBlocker(order({ stockCommitted: false, stockReleased: false })),
    ).toBeNull();
  });

  it.each(["pending", "processing", "shipped", "delivered"] as const)(
    "refuses a %s order, which must be cancelled first",
    (status) => {
      expect(orderDeleteBlocker(order({ status }))).toMatch(/cancelled/i);
    },
  );

  it("refuses an order that was converted to a sale, naming the sale", () => {
    // sales.order_id is ON DELETE SET NULL, so deleting here would orphan the
    // sale — and deleteSale would then wrongly restore its stock.
    const blocker = orderDeleteBlocker(
      order({ convertedSale: { id: "s1", saleNumber: 7 } }),
    );
    expect(blocker).toContain("#7");
  });

  it("refuses a delivered-then-cancelled order whose stock is still deducted", () => {
    expect(orderDeleteBlocker(order({ stockCommitted: true }))).toMatch(
      /already deducted/i,
    );
  });

  it("reports the sale before the stock, as the more specific problem", () => {
    const blocker = orderDeleteBlocker(
      order({
        stockCommitted: true,
        convertedSale: { id: "s1", saleNumber: 7 },
      }),
    );
    expect(blocker).toContain("#7");
  });
});
